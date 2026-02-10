import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Update user payment status from Stripe webhook
export const updatePaymentStatus = mutation({
  args: {
    clerkId: v.optional(v.string()),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("trialing"),
      v.literal("free")
    ),
    paymentExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find user by Stripe customer ID or Clerk ID
    let user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!user && args.clerkId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId!))
        .first();
    }

    if (!user) {
      console.error("User not found for payment update:", args);
      return null;
    }

    // Update user payment status
    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      paymentStatus: args.paymentStatus,
      paymentExpiresAt: args.paymentExpiresAt,
      // Activate user if payment is active
      isActive: args.paymentStatus === "active" || args.paymentStatus === "trialing" || args.paymentStatus === "free",
    });

    // Auto IPTV automation: ensure/renew/suspend based on payment state.
    await ctx.runMutation(internal.iptv.internalHandlePaymentStatusChange, {
      userId: user._id,
      clerkId: user.clerkId,
      paymentStatus: args.paymentStatus,
      paymentExpiresAt: args.paymentExpiresAt,
    });

    return user._id;
  },
});

// Create or update subscription record
export const upsertSubscription = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    userId: v.id("users"),
    status: v.string(),
    priceId: v.string(),
    productId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Record a payment
export const recordPayment = mutation({
  args: {
    stripePaymentId: v.string(),
    stripeCustomerId: v.string(),
    userId: v.optional(v.id("users")),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    description: v.optional(v.string()),
    invoiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if payment already recorded
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment", (q) =>
        q.eq("stripePaymentId", args.stripePaymentId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("payments", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Get user's payment status
export const getPaymentStatus = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return null;
    }

    const subscription = user.stripeSubscriptionId
      ? await ctx.db
          .query("subscriptions")
          .withIndex("by_stripe_subscription", (q) =>
            q.eq("stripeSubscriptionId", user.stripeSubscriptionId!)
          )
          .first()
      : null;

    return {
      paymentStatus: user.paymentStatus || "pending",
      paymentExpiresAt: user.paymentExpiresAt,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    };
  },
});

// Get payment history for a user
export const getPaymentHistory = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return [];
    }

    return await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
  },
});

// Set user's Stripe customer ID
export const setStripeCustomerId = mutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      // Self-service: allow Stripe to attach even if a user row wasn't created yet.
      return await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: "unknown",
        username: "User",
        serverAccess: "none",
        isActive: false,
        paymentStatus: "pending",
        stripeCustomerId: args.stripeCustomerId,
        createdAt: Date.now(),
        lastSeen: Date.now(),
      });
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
    });

    return user._id;
  },
});

// Mark user as free (no payment required) - admin only
export const markUserAsFree = mutation({
  args: {
    userId: v.id("users"),
    adminClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!admin) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      paymentStatus: "free",
      isActive: true,
    });

    return args.userId;
  },
});

// Get all subscriptions (admin)
export const getAllSubscriptions = query({
  args: { adminClerkId: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!admin) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("subscriptions")
      .order("desc")
      .take(100);

    // Get user details for each subscription
    const subscriptionsWithUsers = await Promise.all(
      subscriptions.map(async (sub) => {
        const user = await ctx.db.get(sub.userId);
        return {
          ...sub,
          userEmail: user?.email,
          userName: user?.username,
        };
      })
    );

    return subscriptionsWithUsers;
  },
});

// Get payment stats (admin)
export const getPaymentStats = query({
  args: { adminClerkId: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!admin) {
      return null;
    }

    const allUsers = await ctx.db.query("users").collect();
    const activeSubscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const paidUsers = allUsers.filter((u) => u.paymentStatus === "active").length;
    const pendingUsers = allUsers.filter((u) => u.paymentStatus === "pending" || !u.paymentStatus).length;
    const freeUsers = allUsers.filter((u) => u.paymentStatus === "free").length;

    // Calculate MRR (Monthly Recurring Revenue)
    const mrr = activeSubscriptions.length * 30; // $30 per subscription

    return {
      totalUsers: allUsers.length,
      paidUsers,
      pendingUsers,
      freeUsers,
      activeSubscriptions: activeSubscriptions.length,
      mrr,
    };
  },
});

// Check if user needs payment
export const needsPayment = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return { needsPayment: false, reason: "no_user" };
    }

    // Free users don't need to pay
    if (user.paymentStatus === "free") {
      return { needsPayment: false, reason: "free" };
    }

    // Active or trialing users are good
    if (user.paymentStatus === "active" || user.paymentStatus === "trialing") {
      return { needsPayment: false, reason: "paid" };
    }

    // Everyone else needs to pay
    return { 
      needsPayment: true, 
      reason: user.paymentStatus || "no_payment",
      hasStripeCustomer: !!user.stripeCustomerId,
    };
  },
});

// Sync Stripe subscription data to user by email
export const syncStripeSubscription = mutation({
  args: {
    userEmail: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    subscriptionStatus: v.string(),
    currentPeriodEnd: v.number(),
    priceId: v.optional(v.string()),
    productId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      console.log(`User not found for email: ${args.userEmail}`);
      return { success: false, reason: "user_not_found" };
    }

    // Map Stripe status to our payment status
    let paymentStatus: "pending" | "active" | "past_due" | "canceled" | "unpaid" | "trialing" | "free" = "pending";
    switch (args.subscriptionStatus) {
      case "active":
        paymentStatus = "active";
        break;
      case "trialing":
        paymentStatus = "trialing";
        break;
      case "past_due":
        paymentStatus = "past_due";
        break;
      case "canceled":
        paymentStatus = "canceled";
        break;
      case "unpaid":
        paymentStatus = "unpaid";
        break;
      default:
        paymentStatus = "pending";
    }

    // Determine if user should be active based on payment status
    const isActiveStatus = paymentStatus === "active" || paymentStatus === "trialing";

    // Update user with Stripe info
    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      paymentStatus,
      paymentExpiresAt: args.currentPeriodEnd,
      isActive: isActiveStatus,
    });

    // Upsert subscription record if we have product info
    if (args.productId && args.priceId) {
      const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_stripe_subscription", (q) =>
          q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
        )
        .first();

      const now = Date.now();

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: args.subscriptionStatus,
          currentPeriodEnd: args.currentPeriodEnd,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("subscriptions", {
          stripeSubscriptionId: args.stripeSubscriptionId,
          stripeCustomerId: args.stripeCustomerId,
          userId: user._id,
          status: args.subscriptionStatus,
          priceId: args.priceId,
          productId: args.productId,
          currentPeriodStart: now,
          currentPeriodEnd: args.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { 
      success: true, 
      userId: user._id, 
      paymentStatus,
      email: args.userEmail,
    };
  },
});

// Get Stripe configuration
export const getStripeConfig = query({
  args: {},
  handler: async () => {
    return {
      productId: "prod_TkUnen4Dh6GpAN",
      productName: "Remote Computer Support",
      priceAmount: 3000,
      currency: "usd",
      interval: "month",
    };
  },
});

// ============================================
// Internal mutations for HTTP actions
// ============================================

// Internal: Update payment status
export const internal_updatePaymentStatus = internalMutation({
  args: {
    clerkId: v.optional(v.string()),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("trialing"),
      v.literal("free")
    ),
    paymentExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!user && args.clerkId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId!))
        .first();
    }

    if (!user) {
      console.error("User not found for payment update:", args);
      return null;
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      paymentStatus: args.paymentStatus,
      paymentExpiresAt: args.paymentExpiresAt,
      isActive: args.paymentStatus === "active" || args.paymentStatus === "trialing" || args.paymentStatus === "free",
    });

    // Auto IPTV automation: ensure/renew/suspend based on payment state.
    await ctx.runMutation(internal.iptv.internalHandlePaymentStatusChange, {
      userId: user._id,
      clerkId: user.clerkId,
      paymentStatus: args.paymentStatus,
      paymentExpiresAt: args.paymentExpiresAt,
    });

    return user._id;
  },
});

// Internal: Set Stripe customer ID
export const internal_setStripeCustomerId = internalMutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      // Self-service: if the user record doesn't exist yet, create a minimal pending record.
      // Identity fields will be refreshed by `users.ensure` and/or Clerk webhook.
      return await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: "unknown",
        username: "User",
        serverAccess: "none",
        isActive: false,
        paymentStatus: "pending",
        stripeCustomerId: args.stripeCustomerId,
        createdAt: Date.now(),
        lastSeen: Date.now(),
      });
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
    });

    return user._id;
  },
});

// Internal: Upsert subscription
export const internal_upsertSubscription = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: v.string(),
    priceId: v.string(),
    productId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find user by Stripe customer ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    if (!user) {
      console.error("User not found for subscription:", args.stripeCustomerId);
      return null;
    }

    return await ctx.db.insert("subscriptions", {
      ...args,
      userId: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Internal: Record payment
export const internal_recordPayment = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeInvoiceId: v.string(),
    stripeSubscriptionId: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by Stripe customer ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    // Check if payment already recorded
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment", (q) =>
        q.eq("stripePaymentId", args.stripeInvoiceId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("payments", {
      stripePaymentId: args.stripeInvoiceId,
      stripeCustomerId: args.stripeCustomerId,
      userId: user?._id,
      amount: args.amount,
      currency: args.currency,
      status: args.status,
      invoiceId: args.stripeInvoiceId,
      createdAt: Date.now(),
    });
  },
});

// Internal: Sync Stripe subscription
export const internal_syncStripeSubscription = internalMutation({
  args: {
    userEmail: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    subscriptionStatus: v.string(),
    currentPeriodEnd: v.number(),
    priceId: v.optional(v.string()),
    productId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      console.log(`User not found for email: ${args.userEmail}`);
      return { success: false, reason: "user_not_found" };
    }

    let paymentStatus: "pending" | "active" | "past_due" | "canceled" | "unpaid" | "trialing" | "free" = "pending";
    switch (args.subscriptionStatus) {
      case "active":
        paymentStatus = "active";
        break;
      case "trialing":
        paymentStatus = "trialing";
        break;
      case "past_due":
        paymentStatus = "past_due";
        break;
      case "canceled":
        paymentStatus = "canceled";
        break;
      case "unpaid":
        paymentStatus = "unpaid";
        break;
      default:
        paymentStatus = "pending";
    }

    const isActiveStatus = paymentStatus === "active" || paymentStatus === "trialing";

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      paymentStatus,
      paymentExpiresAt: args.currentPeriodEnd,
      isActive: isActiveStatus,
    });

    if (args.productId && args.priceId) {
      const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_stripe_subscription", (q) =>
          q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
        )
        .first();

      const now = Date.now();

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: args.subscriptionStatus,
          currentPeriodEnd: args.currentPeriodEnd,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("subscriptions", {
          stripeSubscriptionId: args.stripeSubscriptionId,
          stripeCustomerId: args.stripeCustomerId,
          userId: user._id,
          status: args.subscriptionStatus,
          priceId: args.priceId,
          productId: args.productId,
          currentPeriodStart: now,
          currentPeriodEnd: args.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { 
      success: true, 
      userId: user._id, 
      paymentStatus,
      email: args.userEmail,
    };
  },
});

// Internal: Schedule access revocation when payment fails
export const internal_scheduleAccessRevocation = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    reason: v.string(),
    gracePeriodDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find user by Stripe customer ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!user) {
      console.error("User not found for revocation:", args.stripeCustomerId);
      return { scheduled: false, reason: "user_not_found" };
    }

    // Calculate when to revoke access
    const gracePeriodMs = (args.gracePeriodDays || 0) * 24 * 60 * 60 * 1000;
    const revokeAt = Date.now() + gracePeriodMs;

    // Store the scheduled revocation
    const existing = await ctx.db
      .query("scheduledRevocations")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (existing) {
      // Update existing scheduled revocation
      await ctx.db.patch(existing._id, {
        revokeAt,
        reason: args.reason,
        updatedAt: Date.now(),
      });
    } else {
      // Create new scheduled revocation
      await ctx.db.insert("scheduledRevocations", {
        userId: user._id,
        clerkId: user.clerkId,
        stripeCustomerId: args.stripeCustomerId,
        revokeAt,
        reason: args.reason,
        status: "pending",
        createdAt: Date.now(),
      });
    }

    // Log the scheduled revocation
    await ctx.db.insert("auditLog", {
      action: "revocation_scheduled",
      actorId: "system",
      targetType: "user",
      targetId: user._id,
      details: JSON.stringify({
        email: user.email,
        reason: args.reason,
        revokeAt: new Date(revokeAt).toISOString(),
        gracePeriodDays: args.gracePeriodDays || 0,
      }),
      timestamp: Date.now(),
    });

    return { 
      scheduled: true, 
      userId: user._id,
      revokeAt,
      gracePeriodDays: args.gracePeriodDays || 0,
    };
  },
});

// Cancel a scheduled revocation (when user pays) - Internal for webhook calls
export const internal_cancelScheduledRevocation = internalMutation({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by Stripe customer ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!user) return { canceled: false };

    // Find and delete scheduled revocation
    const scheduled = await ctx.db
      .query("scheduledRevocations")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (scheduled) {
      await ctx.db.delete(scheduled._id);
      
      await ctx.db.insert("auditLog", {
        action: "revocation_canceled",
        actorId: "system",
        targetType: "user",
        targetId: user._id,
        details: JSON.stringify({
          email: user.email,
          reason: "Payment received",
        }),
        timestamp: Date.now(),
      });
    }

    return { canceled: !!scheduled };
  },
});

// Public mutation to cancel scheduled revocation
export const cancelScheduledRevocation = mutation({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by Stripe customer ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!user) return { canceled: false };

    // Find and delete scheduled revocation
    const scheduled = await ctx.db
      .query("scheduledRevocations")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (scheduled) {
      await ctx.db.delete(scheduled._id);
      
      await ctx.db.insert("auditLog", {
        action: "revocation_canceled",
        actorId: "system",
        targetType: "user",
        targetId: user._id,
        details: JSON.stringify({
          email: user.email,
          reason: "Payment received",
        }),
        timestamp: Date.now(),
      });
    }

    return { canceled: !!scheduled };
  },
});

// Get pending revocations that are due
export const getPendingRevocations = query({
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("scheduledRevocations")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "pending"),
          q.lte(q.field("revokeAt"), now)
        )
      )
      .collect();
  },
});
