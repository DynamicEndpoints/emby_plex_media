import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Process all scheduled revocations that are due
export const processScheduledRevocations = internalAction({
  handler: async (ctx) => {
    // Get all pending revocations that are due
    const pendingRevocations = await ctx.runQuery(internal.revocations.getPendingDueRevocations);

    const results = {
      processed: 0,
      revoked: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const revocation of pendingRevocations) {
      results.processed++;

      try {
        // Get the user's server access info
        const user = await ctx.runQuery(internal.revocations.getUserForRevocation, {
          userId: revocation.userId,
        });

        if (!user) {
          results.failed++;
          results.errors.push(`User not found: ${revocation.userId}`);
          continue;
        }

        // Check if user's payment is now active (they paid during grace period)
        if (user.paymentStatus === "active" || user.paymentStatus === "trialing" || user.paymentStatus === "free") {
          // Cancel the revocation
          await ctx.runMutation(internal.revocations.cancelRevocation, {
            revocationId: revocation._id,
            reason: "Payment received during grace period",
          });
          continue;
        }

        // Call the external revoke API
        const rawBaseUrl = process.env.SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
        const revokeApiUrl = rawBaseUrl.startsWith("http://") || rawBaseUrl.startsWith("https://")
          ? rawBaseUrl
          : `https://${rawBaseUrl}`;

        const internalApiKey = process.env.INTERNAL_API_KEY;
        if (!internalApiKey) {
          results.failed++;
          results.errors.push("INTERNAL_API_KEY not set in Convex environment");
          continue;
        }

        const response = await fetch(`${revokeApiUrl}/api/revoke-access`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": internalApiKey,
          },
          body: JSON.stringify({
            clerkId: user.clerkId,
            action: "disable",
            reason: revocation.reason,
          }),
        });

        const data = await response.json();

        if (data.success) {
          results.revoked++;
          
          // Mark revocation as completed
          await ctx.runMutation(internal.revocations.completeRevocation, {
            revocationId: revocation._id,
          });
        } else {
          results.failed++;
          results.errors.push(`Failed to revoke ${user.email}: ${data.error || "Unknown error"}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error processing ${revocation.userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    console.log("Revocation processing completed:", results);
    return results;
  },
});

// Sync subscription statuses from Stripe (catch missed webhooks)
export const syncSubscriptionStatuses = internalAction({
  handler: async (ctx) => {
    // Get all users with Stripe subscriptions
    const usersWithSubscriptions = await ctx.runQuery(internal.revocations.getUsersWithSubscriptions);

    const results = {
      checked: 0,
      updated: 0,
      errors: [] as string[],
    };

    // This would ideally call Stripe to verify each subscription
    // For now, just log that it ran
    console.log(`Subscription sync: ${usersWithSubscriptions.length} users to check`);
    results.checked = usersWithSubscriptions.length;

    return results;
  },
});

// Query: Get pending revocations that are due
export const getPendingDueRevocations = internalQuery({
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("scheduledRevocations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lte(q.field("revokeAt"), now))
      .collect();
  },
});

// Query: Get user info for revocation
export const getUserForRevocation = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Query: Get users with Stripe subscriptions
export const getUsersWithSubscriptions = internalQuery({
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter((u) => u.stripeSubscriptionId);
  },
});

// Mutation: Mark revocation as completed
export const completeRevocation = internalMutation({
  args: { revocationId: v.id("scheduledRevocations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.revocationId, {
      status: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Mutation: Cancel a scheduled revocation
export const cancelRevocation = internalMutation({
  args: {
    revocationId: v.id("scheduledRevocations"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const revocation = await ctx.db.get(args.revocationId);
    if (!revocation) return;

    await ctx.db.patch(args.revocationId, {
      status: "canceled",
      updatedAt: Date.now(),
    });

    // Log the cancellation
    await ctx.db.insert("auditLog", {
      action: "revocation_canceled",
      actorId: "system",
      targetType: "user",
      targetId: revocation.userId,
      details: JSON.stringify({ reason: args.reason }),
      timestamp: Date.now(),
    });
  },
});
