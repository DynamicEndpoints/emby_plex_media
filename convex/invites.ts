import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nanoid } from "nanoid";

// Generate a unique invite code
function generateInviteCode(): string {
  return nanoid(10).toUpperCase();
}

// Create a new invite
export const create = mutation({
  args: {
    email: v.optional(v.string()),
    maxUses: v.number(),
    expiresAt: v.optional(v.number()),
    serverType: v.union(v.literal("plex"), v.literal("emby"), v.literal("both")),
    libraries: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const code = generateInviteCode();
    
    const inviteId = await ctx.db.insert("invites", {
      code,
      email: args.email,
      maxUses: args.maxUses,
      usedCount: 0,
      expiresAt: args.expiresAt,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      isActive: true,
      serverType: args.serverType,
      libraries: args.libraries,
      notes: args.notes,
    });

    // Log the action
    await ctx.db.insert("auditLog", {
      action: "invite_created",
      actorId: args.createdBy,
      targetType: "invite",
      targetId: inviteId,
      details: JSON.stringify({ code, maxUses: args.maxUses }),
      timestamp: Date.now(),
    });

    return { inviteId, code };
  },
});

// Get invite by code (public - for redemption)
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!invite) return null;

    // Check if still valid
    const isExpired = invite.expiresAt && invite.expiresAt < Date.now();
    const isUsedUp = invite.usedCount >= invite.maxUses;

    return {
      ...invite,
      isValid: invite.isActive && !isExpired && !isUsedUp,
      isExpired,
      isUsedUp,
    };
  },
});

// List all invites (admin)
export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const invites = args.activeOnly
      ? await ctx.db
          .query("invites")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .order("desc")
          .collect()
      : await ctx.db.query("invites").order("desc").collect();

    return invites.map((invite) => {
      const isExpired = invite.expiresAt && invite.expiresAt < Date.now();
      const isUsedUp = invite.usedCount >= invite.maxUses;
      return {
        ...invite,
        isValid: invite.isActive && !isExpired && !isUsedUp,
        isExpired,
        isUsedUp,
      };
    });
  },
});

// Get single invite by ID (admin)
export const getById = query({
  args: { id: v.id("invites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Redeem an invite
export const redeem = mutation({
  args: {
    code: v.string(),
    clerkId: v.string(),
    email: v.string(),
    username: v.string(),
    plexUsername: v.optional(v.string()),
    embyUserId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the invite
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!invite) {
      throw new Error("Invalid invite code");
    }

    // Validate invite
    if (!invite.isActive) {
      throw new Error("This invite has been deactivated");
    }

    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      throw new Error("This invite has expired");
    }

    if (invite.usedCount >= invite.maxUses) {
      throw new Error("This invite has reached its maximum uses");
    }

    if (invite.email && invite.email.toLowerCase() !== args.email.toLowerCase()) {
      throw new Error("This invite is restricted to a specific email address");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      throw new Error("You have already redeemed an invite");
    }

    // Create user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      username: args.username,
      inviteCode: args.code.toUpperCase(),
      plexUsername: args.plexUsername,
      embyUserId: args.embyUserId,
      serverAccess: invite.serverType,
      isActive: true,
      createdAt: Date.now(),
    });

    // Record redemption
    await ctx.db.insert("redemptions", {
      inviteId: invite._id,
      userId,
      redeemedAt: Date.now(),
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    // Increment use count
    await ctx.db.patch(invite._id, {
      usedCount: invite.usedCount + 1,
    });

    // Log the action
    await ctx.db.insert("auditLog", {
      action: "invite_redeemed",
      actorId: args.clerkId,
      actorEmail: args.email,
      targetType: "invite",
      targetId: invite._id,
      details: JSON.stringify({ code: args.code, username: args.username }),
      timestamp: Date.now(),
    });

    return {
      userId,
      serverType: invite.serverType,
      libraries: invite.libraries,
    };
  },
});

// Deactivate an invite
export const deactivate = mutation({
  args: {
    id: v.id("invites"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });

    await ctx.db.insert("auditLog", {
      action: "invite_deactivated",
      actorId: args.adminId,
      targetType: "invite",
      targetId: args.id,
      timestamp: Date.now(),
    });
  },
});

// Reactivate an invite
export const reactivate = mutation({
  args: {
    id: v.id("invites"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: true });

    await ctx.db.insert("auditLog", {
      action: "invite_reactivated",
      actorId: args.adminId,
      targetType: "invite",
      targetId: args.id,
      timestamp: Date.now(),
    });
  },
});

// Delete an invite
export const remove = mutation({
  args: {
    id: v.id("invites"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.id);
    
    await ctx.db.delete(args.id);

    await ctx.db.insert("auditLog", {
      action: "invite_deleted",
      actorId: args.adminId,
      targetType: "invite",
      details: JSON.stringify({ code: invite?.code }),
      timestamp: Date.now(),
    });
  },
});

// Get invite statistics
export const getStats = query({
  handler: async (ctx) => {
    const allInvites = await ctx.db.query("invites").collect();
    const activeInvites = allInvites.filter((i) => i.isActive);
    const totalRedemptions = allInvites.reduce((sum, i) => sum + i.usedCount, 0);

    return {
      totalInvites: allInvites.length,
      activeInvites: activeInvites.length,
      totalRedemptions,
    };
  },
});
