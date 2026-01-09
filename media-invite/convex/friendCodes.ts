import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a random friend code
function generateFriendCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars
  let code = "FR-"; // Friend code prefix
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if a user can generate friend codes (must have active server access)
export const canGenerateCodes = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || !user.isActive) {
      return { canGenerate: false, reason: "No active server access" };
    }

    if (user.serverAccess === "none") {
      return { canGenerate: false, reason: "No server access" };
    }

    // Check if friend codes are enabled (admin setting)
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "friend_codes_enabled"))
      .first();

    const friendCodesEnabled = setting?.value !== "false"; // Default to true

    if (!friendCodesEnabled) {
      return { canGenerate: false, reason: "Friend codes are disabled by admin" };
    }

    return {
      canGenerate: true,
      serverAccess: user.serverAccess,
      libraries: user.inviteCode ? undefined : undefined, // Could inherit libraries
    };
  },
});

// Generate a new friend code
export const generate = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    maxUses: v.optional(v.number()),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if user can generate codes
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || !user.isActive || user.serverAccess === "none") {
      throw new Error("You must have active server access to generate friend codes");
    }

    // Check if friend codes are enabled
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "friend_codes_enabled"))
      .first();

    if (setting?.value === "false") {
      throw new Error("Friend codes are disabled");
    }

    // Check max codes per user setting
    const maxCodesSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "max_friend_codes_per_user"))
      .first();

    const maxCodesPerUser = maxCodesSetting ? parseInt(maxCodesSetting.value) : 5;

    // Count user's active codes
    const userCodes = await ctx.db
      .query("friendCodes")
      .withIndex("by_creator", (q) => q.eq("createdBy", args.clerkId))
      .collect();

    const activeCodes = userCodes.filter((c) => c.isActive);
    if (activeCodes.length >= maxCodesPerUser) {
      throw new Error(`You can only have ${maxCodesPerUser} active friend codes`);
    }

    // Generate unique code
    let code = generateFriendCode();
    let existingCode = await ctx.db
      .query("friendCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    while (existingCode) {
      code = generateFriendCode();
      existingCode = await ctx.db
        .query("friendCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }

    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
      : undefined;

    const friendCodeId = await ctx.db.insert("friendCodes", {
      code,
      createdBy: args.clerkId,
      createdByEmail: args.email,
      maxUses: args.maxUses || 1,
      usedCount: 0,
      expiresAt,
      isActive: true,
      createdAt: Date.now(),
      serverType: user.serverAccess as "plex" | "emby" | "both",
    });

    await ctx.db.insert("auditLog", {
      action: "friend_code_created",
      actorId: args.clerkId,
      actorEmail: args.email,
      targetType: "friendCode",
      targetId: friendCodeId,
      details: JSON.stringify({ code, maxUses: args.maxUses || 1 }),
      timestamp: Date.now(),
    });

    return { code, id: friendCodeId };
  },
});

// List user's friend codes
export const listByUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const codes = await ctx.db
      .query("friendCodes")
      .withIndex("by_creator", (q) => q.eq("createdBy", args.clerkId))
      .order("desc")
      .collect();

    return codes;
  },
});

// List all friend codes (admin)
export const listAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("friendCodes").order("desc").collect();
  },
});

// Get friend code by code string
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("friendCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
  },
});

// Validate a friend code (for signup)
export const validate = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const friendCode = await ctx.db
      .query("friendCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!friendCode) {
      return { valid: false, reason: "Invalid code" };
    }

    if (!friendCode.isActive) {
      return { valid: false, reason: "Code is no longer active" };
    }

    if (friendCode.usedCount >= friendCode.maxUses) {
      return { valid: false, reason: "Code has reached maximum uses" };
    }

    if (friendCode.expiresAt && friendCode.expiresAt < Date.now()) {
      return { valid: false, reason: "Code has expired" };
    }

    return {
      valid: true,
      serverType: friendCode.serverType,
      createdByEmail: friendCode.createdByEmail,
    };
  },
});

// Redeem a friend code
export const redeem = mutation({
  args: {
    code: v.string(),
    clerkId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const friendCode = await ctx.db
      .query("friendCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!friendCode) {
      throw new Error("Invalid friend code");
    }

    if (!friendCode.isActive) {
      throw new Error("This code is no longer active");
    }

    if (friendCode.usedCount >= friendCode.maxUses) {
      throw new Error("This code has reached its maximum uses");
    }

    if (friendCode.expiresAt && friendCode.expiresAt < Date.now()) {
      throw new Error("This code has expired");
    }

    // Check if user already redeemed this code
    const existingRedemption = await ctx.db
      .query("friendCodeRedemptions")
      .withIndex("by_user", (q) => q.eq("clerkId", args.clerkId))
      .collect();

    if (existingRedemption.some((r) => r.friendCodeId === friendCode._id)) {
      throw new Error("You have already used this code");
    }

    // Increment used count
    await ctx.db.patch(friendCode._id, {
      usedCount: friendCode.usedCount + 1,
    });

    // Record redemption
    await ctx.db.insert("friendCodeRedemptions", {
      friendCodeId: friendCode._id,
      clerkId: args.clerkId,
      email: args.email,
      redeemedAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      action: "friend_code_redeemed",
      actorId: args.clerkId,
      actorEmail: args.email,
      targetType: "friendCode",
      targetId: friendCode._id,
      details: JSON.stringify({ code: friendCode.code, referrer: friendCode.createdByEmail }),
      timestamp: Date.now(),
    });

    return {
      success: true,
      serverType: friendCode.serverType,
      referredBy: friendCode.createdByEmail,
    };
  },
});

// Deactivate a friend code
export const deactivate = mutation({
  args: {
    codeId: v.id("friendCodes"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db.get(args.codeId);
    if (!code) {
      throw new Error("Code not found");
    }

    // Users can only deactivate their own codes (admins check elsewhere)
    if (code.createdBy !== args.clerkId) {
      throw new Error("You can only deactivate your own codes");
    }

    await ctx.db.patch(args.codeId, { isActive: false });

    await ctx.db.insert("auditLog", {
      action: "friend_code_deactivated",
      actorId: args.clerkId,
      targetType: "friendCode",
      targetId: args.codeId,
      details: JSON.stringify({ code: code.code }),
      timestamp: Date.now(),
    });
  },
});

// Admin: deactivate any code
export const adminDeactivate = mutation({
  args: {
    codeId: v.id("friendCodes"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db.get(args.codeId);
    if (!code) {
      throw new Error("Code not found");
    }

    await ctx.db.patch(args.codeId, { isActive: false });

    await ctx.db.insert("auditLog", {
      action: "friend_code_admin_deactivated",
      actorId: args.adminId,
      targetType: "friendCode",
      targetId: args.codeId,
      details: JSON.stringify({ code: code.code }),
      timestamp: Date.now(),
    });
  },
});

// Get stats for friend codes
export const getStats = query({
  handler: async (ctx) => {
    const allCodes = await ctx.db.query("friendCodes").collect();
    const activeCodes = allCodes.filter((c) => c.isActive);
    const totalRedemptions = allCodes.reduce((sum, c) => sum + c.usedCount, 0);

    return {
      totalCodes: allCodes.length,
      activeCodes: activeCodes.length,
      totalRedemptions,
    };
  },
});
