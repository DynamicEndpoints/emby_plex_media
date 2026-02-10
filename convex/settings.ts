import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Re-export from shared constants for backwards compatibility
export { SETTINGS_KEYS } from "../lib/constants";

// Get a single setting
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    return setting?.value ?? null;
  },
});

// Get multiple settings
export const getMany = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const settings: Record<string, string | null> = {};

    for (const key of args.keys) {
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      settings[key] = setting?.value ?? null;
    }

    return settings;
  },
});

// Get all settings
export const getAll = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, string>
    );
  },
});

// Set a setting
export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    } else {
      await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    }

    // Log sensitive settings changes
    const sensitiveKeys = [
      "plex_token",
      "emby_api_key",
      "xtreme_ui_api_key",
      "webhook_secret",
    ];
    const isSensitive = sensitiveKeys.includes(args.key);

    await ctx.db.insert("auditLog", {
      action: "setting_updated",
      actorId: args.adminId,
      targetType: "setting",
      details: JSON.stringify({
        key: args.key,
        value: isSensitive ? "[REDACTED]" : args.value,
      }),
      timestamp: Date.now(),
    });
  },
});

// Set multiple settings
export const setMany = mutation({
  args: {
    settings: v.array(v.object({ key: v.string(), value: v.string() })),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    for (const { key, value } of args.settings) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          value,
          updatedAt: Date.now(),
          updatedBy: args.adminId,
        });
      } else {
        await ctx.db.insert("settings", {
          key,
          value,
          updatedAt: Date.now(),
          updatedBy: args.adminId,
        });
      }
    }

    await ctx.db.insert("auditLog", {
      action: "settings_bulk_updated",
      actorId: args.adminId,
      targetType: "settings",
      details: JSON.stringify({ count: args.settings.length }),
      timestamp: Date.now(),
    });
  },
});

// Delete a setting
export const remove = mutation({
  args: {
    key: v.string(),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);

      await ctx.db.insert("auditLog", {
        action: "setting_deleted",
        actorId: args.adminId,
        targetType: "setting",
        details: JSON.stringify({ key: args.key }),
        timestamp: Date.now(),
      });
    }
  },
});
