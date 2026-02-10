import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Record a donation and (if possible) immediately grant/keep access for a matching user.
export const recordBuyMeACoffeeDonation = mutation({
  args: {
    eventType: v.optional(v.string()),
    externalId: v.optional(v.string()),
    supporterEmail: v.string(),
    plexUserId: v.optional(v.string()),
    embyUserId: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    message: v.optional(v.string()),
    raw: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supporterEmail = normalizeEmail(args.supporterEmail);

    // De-dupe by provider+externalId when we have it
    if (args.externalId) {
      const existing = await ctx.db
        .query("donations")
        .withIndex("by_provider_external", (q) =>
          q.eq("provider", "buymeacoffee").eq("externalId", args.externalId)
        )
        .first();

      if (existing) {
        return { donationId: existing._id, appliedToUserId: null, deduped: true };
      }
    }

    const donationId = await ctx.db.insert("donations", {
      provider: "buymeacoffee",
      eventType: args.eventType,
      externalId: args.externalId,
      supporterEmail,
      amount: args.amount,
      currency: args.currency,
      message: args.message,
      raw: args.raw,
      createdAt: Date.now(),
    });

    // Try to find a matching user record (by Plex/Emby userId OR login email OR plex email)
    const usersToPatch: any[] = [];

    if (args.plexUserId) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_plex_user_id", (q) => q.eq("plexUserId", args.plexUserId!))
        .first();
      if (u) usersToPatch.push(u);
    }

    if (args.embyUserId) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_emby_user_id", (q) => q.eq("embyUserId", args.embyUserId!))
        .first();
      if (u) usersToPatch.push(u);
    }

    const userByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", supporterEmail))
      .first();

    if (userByEmail) usersToPatch.push(userByEmail);

    const allUsers = userByEmail ? null : await ctx.db.query("users").collect();
    const userByPlexEmail =
      allUsers?.find((u) => (u.plexEmail || "").toLowerCase() === supporterEmail) || null;
    if (userByPlexEmail) usersToPatch.push(userByPlexEmail);

    const uniqueUserIds = Array.from(
      new Set(usersToPatch.map((u) => u?._id).filter((id) => id != null)),
    );

    for (const userId of uniqueUserIds) {
      await ctx.db.patch(userId, {
        paymentStatus: "free",
        isActive: true,
        accessRevokedAt: undefined,
        accessRevokedReason: undefined,
      });

      await ctx.runMutation(internal.iptv.internalHandlePaymentStatusChange, {
        userId,
        paymentStatus: "free",
      });

      await ctx.db.insert("auditLog", {
        action: "donation_received",
        actorId: "system",
        actorEmail: supporterEmail,
        targetType: "user",
        targetId: userId,
        details: JSON.stringify({
          provider: "buymeacoffee",
          amount: args.amount,
          currency: args.currency,
          externalId: args.externalId,
          plexUserId: args.plexUserId,
          embyUserId: args.embyUserId,
        }),
        timestamp: Date.now(),
      });
    }

    return {
      donationId,
      appliedToUserId: uniqueUserIds.length === 1 ? uniqueUserIds[0] : null,
      appliedToUserIds: uniqueUserIds,
      deduped: false,
    };
  },
});

// Used by self-service signup/login to grant access if a donation exists.
export const hasDonationForEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const donation = await ctx.db
      .query("donations")
      .withIndex("by_email", (q) => q.eq("supporterEmail", email))
      .order("desc")
      .first();

    return {
      hasDonation: !!donation,
      lastDonationAt: donation?.createdAt,
      provider: donation?.provider,
    };
  },
});
