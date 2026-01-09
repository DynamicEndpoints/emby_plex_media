import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all users
export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const users = args.activeOnly
      ? await ctx.db
          .query("users")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .order("desc")
          .collect()
      : await ctx.db.query("users").order("desc").collect();
    return users;
  },
});

// Get user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Get user by ID
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Update user's last seen
export const updateLastSeen = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { lastSeen: Date.now() });
    }
  },
});

// Revoke user access
export const revoke = mutation({
  args: {
    id: v.id("users"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.id, {
      isActive: false,
      revokedAt: Date.now(),
      revokedBy: args.adminId,
    });

    await ctx.db.insert("auditLog", {
      action: "user_revoked",
      actorId: args.adminId,
      targetType: "user",
      targetId: args.id,
      details: JSON.stringify({ email: user.email, username: user.username }),
      timestamp: Date.now(),
    });

    return user;
  },
});

// Restore user access
export const restore = mutation({
  args: {
    id: v.id("users"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.id, {
      isActive: true,
      revokedAt: undefined,
      revokedBy: undefined,
    });

    await ctx.db.insert("auditLog", {
      action: "user_restored",
      actorId: args.adminId,
      targetType: "user",
      targetId: args.id,
      details: JSON.stringify({ email: user.email, username: user.username }),
      timestamp: Date.now(),
    });

    return user;
  },
});

// Delete user
export const remove = mutation({
  args: {
    id: v.id("users"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("User not found");

    // Delete redemption records
    const redemptions = await ctx.db
      .query("redemptions")
      .withIndex("by_user", (q) => q.eq("userId", args.id))
      .collect();

    for (const redemption of redemptions) {
      await ctx.db.delete(redemption._id);
    }

    await ctx.db.delete(args.id);

    await ctx.db.insert("auditLog", {
      action: "user_deleted",
      actorId: args.adminId,
      targetType: "user",
      details: JSON.stringify({ email: user.email, username: user.username }),
      timestamp: Date.now(),
    });
  },
});

// Get user statistics
export const getStats = query({
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const activeUsers = allUsers.filter((u) => u.isActive);
    const plexUsers = allUsers.filter(
      (u) => u.serverAccess === "plex" || u.serverAccess === "both"
    );
    const embyUsers = allUsers.filter(
      (u) => u.serverAccess === "emby" || u.serverAccess === "both"
    );

    // Recent signups (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentSignups = allUsers.filter((u) => u.createdAt > weekAgo);

    return {
      totalUsers: allUsers.length,
      activeUsers: activeUsers.length,
      revokedUsers: allUsers.length - activeUsers.length,
      plexUsers: plexUsers.length,
      embyUsers: embyUsers.length,
      recentSignups: recentSignups.length,
    };
  },
});

// Search users
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();
    const searchLower = args.query.toLowerCase();

    return allUsers.filter(
      (user) =>
        user.email.toLowerCase().includes(searchLower) ||
        user.username.toLowerCase().includes(searchLower) ||
        user.plexUsername?.toLowerCase().includes(searchLower) ||
        user.embyUsername?.toLowerCase().includes(searchLower) ||
        user.inviteCode?.toLowerCase().includes(searchLower)
    );
  },
});

// Create user from webhook (Clerk)
export const createFromWebhook = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    // This creates a pending user - they still need to redeem an invite
    // or be auto-linked via the link-accounts API
    return null;
  },
});

// Link an existing Plex/Emby account to a Clerk user
export const linkExistingAccount = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    username: v.string(),
    serverAccess: v.union(v.literal("plex"), v.literal("emby"), v.literal("both"), v.literal("none")),
    embyUserId: v.optional(v.string()),
    embyUsername: v.optional(v.string()),
    plexUserId: v.optional(v.string()),
    plexUsername: v.optional(v.string()),
    plexEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // Update existing user with linked accounts
      await ctx.db.patch(existingUser._id, {
        serverAccess: args.serverAccess,
        embyUserId: args.embyUserId,
        embyUsername: args.embyUsername,
        plexUserId: args.plexUserId,
        plexUsername: args.plexUsername,
        plexEmail: args.plexEmail,
        isAutoLinked: true,
      });

      await ctx.db.insert("auditLog", {
        action: "account_linked",
        actorId: args.clerkId,
        targetType: "user",
        targetId: existingUser._id,
        details: JSON.stringify({
          email: args.email,
          serverAccess: args.serverAccess,
          embyUsername: args.embyUsername,
          plexUsername: args.plexUsername,
        }),
        timestamp: Date.now(),
      });

      return existingUser._id;
    }

    // Create new user with linked accounts
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      username: args.username,
      serverAccess: args.serverAccess,
      embyUserId: args.embyUserId,
      embyUsername: args.embyUsername,
      plexUserId: args.plexUserId,
      plexUsername: args.plexUsername,
      plexEmail: args.plexEmail,
      isActive: true,
      isAutoLinked: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      action: "user_auto_linked",
      actorId: args.clerkId,
      targetType: "user",
      targetId: userId,
      details: JSON.stringify({
        email: args.email,
        serverAccess: args.serverAccess,
        embyUsername: args.embyUsername,
        plexUsername: args.plexUsername,
      }),
      timestamp: Date.now(),
    });

    return userId;
  },
});

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Update user access status (for revocation)
export const updateAccessStatus = mutation({
  args: {
    id: v.id("users"),
    isActive: v.boolean(),
    accessRevokedAt: v.optional(v.number()),
    accessRevokedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.id, {
      isActive: args.isActive,
      accessRevokedAt: args.accessRevokedAt,
      accessRevokedReason: args.accessRevokedReason,
    });

    await ctx.db.insert("auditLog", {
      action: args.isActive ? "access_restored" : "access_revoked",
      actorId: "system",
      targetType: "user",
      targetId: args.id,
      details: JSON.stringify({ 
        email: user.email, 
        reason: args.accessRevokedReason 
      }),
      timestamp: Date.now(),
    });

    return user;
  },
});

// Get users with expired payment (past_due, canceled, or expired paymentExpiresAt)
export const getExpiredPaymentUsers = query({
  handler: async (ctx) => {
    const now = Date.now();
    const allUsers = await ctx.db.query("users").collect();
    
    return allUsers.filter((user) => {
      // Skip free users
      if (user.paymentStatus === "free") return false;
      
      // Already inactive
      if (!user.isActive) return false;
      
      // Payment failed
      if (user.paymentStatus === "past_due" || 
          user.paymentStatus === "canceled" ||
          user.paymentStatus === "unpaid") {
        return true;
      }
      
      // Payment expired (with 3-day grace period)
      const gracePeriod = 3 * 24 * 60 * 60 * 1000; // 3 days
      if (user.paymentExpiresAt && user.paymentExpiresAt + gracePeriod < now) {
        return true;
      }
      
      return false;
    });
  },
});
