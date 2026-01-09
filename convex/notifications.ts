import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Log a webhook event
export const logWebhook = mutation({
  args: {
    webhookUrl: v.string(),
    event: v.string(),
    payload: v.string(),
    status: v.union(v.literal("success"), v.literal("failed")),
    responseCode: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Get recent webhook logs
export const getWebhookLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("webhookLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);

    return logs;
  },
});

// Get audit logs
export const getAuditLogs = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logs = args.action
      ? await ctx.db
          .query("auditLog")
          .withIndex("by_action", (q) => q.eq("action", args.action!))
          .order("desc")
          .take(args.limit ?? 100)
      : await ctx.db
          .query("auditLog")
          .withIndex("by_timestamp")
          .order("desc")
          .take(args.limit ?? 100);
    return logs;
  },
});

// Create an audit log entry
export const createAuditLog = mutation({
  args: {
    action: v.string(),
    actorId: v.string(),
    actorEmail: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      action: args.action,
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      targetType: args.targetType,
      targetId: args.targetId,
      details: args.details,
      timestamp: Date.now(),
    });
  },
});

// Clear old webhook logs (keep last 30 days)
export const cleanupWebhookLogs = mutation({
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const oldLogs = await ctx.db
      .query("webhookLogs")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), thirtyDaysAgo))
      .collect();

    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
    }

    return { deleted: oldLogs.length };
  },
});
