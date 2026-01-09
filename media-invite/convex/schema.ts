import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Invite codes table
  invites: defineTable({
    code: v.string(),
    email: v.optional(v.string()), // Optional: restrict to specific email
    maxUses: v.number(),
    usedCount: v.number(),
    expiresAt: v.optional(v.number()), // Unix timestamp
    createdBy: v.string(), // Admin user ID
    createdAt: v.number(),
    isActive: v.boolean(),
    serverType: v.union(v.literal("plex"), v.literal("emby"), v.literal("both")),
    libraries: v.optional(v.array(v.string())), // Specific library IDs to grant access
    notes: v.optional(v.string()),
    requiresPayment: v.optional(v.boolean()), // Whether this invite requires payment
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"])
    .index("by_email", ["email"]),

  // Users who redeemed invites or were auto-linked
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    username: v.string(),
    inviteCode: v.optional(v.string()), // Which invite they used (optional for auto-linked users)
    plexUsername: v.optional(v.string()),
    plexUserId: v.optional(v.string()), // Plex user ID for linked accounts
    plexEmail: v.optional(v.string()), // Plex email for linked accounts
    embyUserId: v.optional(v.string()),
    embyUsername: v.optional(v.string()), // Emby username for linked accounts  
    serverAccess: v.union(v.literal("plex"), v.literal("emby"), v.literal("both"), v.literal("none")),
    isActive: v.boolean(),
    isAutoLinked: v.optional(v.boolean()), // True if account was auto-linked from existing server account
    createdAt: v.number(),
    lastSeen: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.string()),
    // Payment fields
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    paymentStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("trialing"),
      v.literal("free") // For users who don't require payment
    )),
    paymentExpiresAt: v.optional(v.number()), // When current billing period ends
    accessRevokedAt: v.optional(v.number()), // When access was revoked
    accessRevokedReason: v.optional(v.string()), // Why access was revoked
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_invite_code", ["inviteCode"])
    .index("by_active", ["isActive"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // Scheduled access revocations (for grace periods)
  scheduledRevocations: defineTable({
    userId: v.id("users"),
    clerkId: v.string(),
    stripeCustomerId: v.string(),
    revokeAt: v.number(), // When to revoke access
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("canceled")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_revoke_at", ["revokeAt"]),

  // Stripe subscriptions tracking
  subscriptions: defineTable({
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    userId: v.id("users"),
    status: v.string(), // active, past_due, canceled, etc.
    priceId: v.string(),
    productId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_stripe_subscription", ["stripeSubscriptionId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Payment history
  payments: defineTable({
    stripePaymentId: v.string(),
    stripeCustomerId: v.string(),
    userId: v.optional(v.id("users")),
    amount: v.number(), // In cents
    currency: v.string(),
    status: v.string(), // succeeded, failed, pending
    description: v.optional(v.string()),
    invoiceId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_stripe_payment", ["stripePaymentId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["createdAt"]),

  // Redemption history
  redemptions: defineTable({
    inviteId: v.id("invites"),
    userId: v.id("users"),
    redeemedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_invite", ["inviteId"])
    .index("by_user", ["userId"]),

  // App settings
  settings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Audit log
  auditLog: defineTable({
    action: v.string(),
    actorId: v.string(),
    actorEmail: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_actor", ["actorId"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"]),

  // Webhook logs
  webhookLogs: defineTable({
    webhookUrl: v.string(),
    event: v.string(),
    payload: v.string(),
    status: v.union(v.literal("success"), v.literal("failed")),
    responseCode: v.optional(v.number()),
    error: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  // Admin users
  admins: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("admin")),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // Friend/referral codes - generated by users with access
  friendCodes: defineTable({
    code: v.string(),
    createdBy: v.string(), // Clerk ID of user who created it
    createdByEmail: v.string(),
    maxUses: v.number(), // How many times it can be used
    usedCount: v.number(),
    expiresAt: v.optional(v.number()), // Unix timestamp
    isActive: v.boolean(),
    createdAt: v.number(),
    // Inherit settings from creator's access
    serverType: v.union(v.literal("plex"), v.literal("emby"), v.literal("both")),
    libraries: v.optional(v.array(v.string())), // Libraries to grant (same as creator or subset)
  })
    .index("by_code", ["code"])
    .index("by_creator", ["createdBy"])
    .index("by_active", ["isActive"]),

  // Track friend code redemptions
  friendCodeRedemptions: defineTable({
    friendCodeId: v.id("friendCodes"),
    clerkId: v.string(), // Who redeemed it
    email: v.string(),
    redeemedAt: v.number(),
  })
    .index("by_code", ["friendCodeId"])
    .index("by_user", ["clerkId"]),
});
