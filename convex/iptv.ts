import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateUsernameFromEmail(email: string): string {
  const cleaned = normalizeEmail(email).split("@")[0] || "user";
  return cleaned.replace(/[^a-z0-9_\-.]/g, "");
}

function generatePassword(length = 14): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return out;
}

async function getSetting(ctx: any, key: string): Promise<string | null> {
  const s = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  return s?.value ?? null;
}

function deriveOriginUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.trim().replace(/\/$/, "");
  }
}

async function enqueueJob(ctx: any, args: {
  type: string;
  userId?: Id<"users">;
  clerkId?: string;
  payload?: any;
  runAt?: number;
  maxAttempts?: number;
}) {
  const now = Date.now();
  const jobId = await ctx.db.insert("jobs", {
    type: args.type,
    status: "pending",
    userId: args.userId,
    clerkId: args.clerkId,
    payload: args.payload ? JSON.stringify(args.payload) : undefined,
    attempts: 0,
    maxAttempts: args.maxAttempts ?? 10,
    nextRunAt: args.runAt ?? now,
    createdAt: now,
    updatedAt: now,
  });
  return jobId;
}

export const getMyAccount = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!account) return null;

    const plan = account.planId ? await ctx.db.get(account.planId) : null;

    return {
      ...account,
      plan,
    };
  },
});

export const listPlans = query({
  args: {
    provider: v.optional(v.union(v.literal("xtremeui"))),
  },
  handler: async (ctx, args) => {
    const provider = args.provider ?? "xtremeui";
    return await ctx.db
      .query("iptvPlans")
      .withIndex("by_provider", (q) => q.eq("provider", provider))
      .order("asc")
      .collect();
  },
});

export const getConfigStatus = query({
  args: {},
  handler: async (ctx) => {
    const xtremeUrl = await getSetting(ctx, "xtreme_ui_url");
    const apiKey = await getSetting(ctx, "xtreme_ui_api_key");
    const streamBaseUrl = await getSetting(ctx, "xtreme_ui_stream_base_url");

    const derivedStreamBaseUrl = (() => {
      if (streamBaseUrl) return streamBaseUrl;
      if (!xtremeUrl) return null;
      try {
        const u = new URL(xtremeUrl);
        return `${u.protocol}//${u.host}`;
      } catch {
        return xtremeUrl;
      }
    })();

    const missing: string[] = [];
    if (!xtremeUrl) missing.push("xtreme_ui_url");
    if (!apiKey) missing.push("xtreme_ui_api_key");

    return {
      configured: missing.length === 0,
      missing,
      panelUrl: xtremeUrl,
      streamBaseUrl: derivedStreamBaseUrl,
    };
  },
});

function requireAdmin() {
  return async (ctx: any, adminClerkId: string) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", adminClerkId))
      .first();
    if (!admin) throw new Error("Unauthorized");
    return admin;
  };
}

export const adminUpsertPlan = mutation({
  args: {
    adminClerkId: v.string(),
    id: v.optional(v.id("iptvPlans")),
    provider: v.optional(v.union(v.literal("xtremeui"))),
    name: v.string(),
    description: v.optional(v.string()),
    bouquetIds: v.optional(v.array(v.string())),
    durationDays: v.optional(v.number()),
    stripePriceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin()(ctx, args.adminClerkId);

    const now = Date.now();
    const provider = args.provider ?? "xtremeui";

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Plan not found");

      await ctx.db.patch(args.id, {
        provider,
        name: args.name,
        description: args.description,
        bouquetIds: args.bouquetIds,
        durationDays: args.durationDays,
        stripePriceId: args.stripePriceId,
        updatedAt: now,
      });
      return args.id;
    }

    return await ctx.db.insert("iptvPlans", {
      provider,
      name: args.name,
      description: args.description,
      bouquetIds: args.bouquetIds,
      durationDays: args.durationDays,
      stripePriceId: args.stripePriceId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adminDeletePlan = mutation({
  args: {
    adminClerkId: v.string(),
    id: v.id("iptvPlans"),
  },
  handler: async (ctx, args) => {
    await requireAdmin()(ctx, args.adminClerkId);

    const plan = await ctx.db.get(args.id);
    if (!plan) return { deleted: false };

    // Prevent deleting a plan that is currently assigned to an account.
    const inUse = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_plan", (q) => q.eq("planId", args.id))
      .first();
    if (inUse) {
      throw new Error("VALIDATION_ERROR: Plan is in use by an IPTV account");
    }

    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

export const requestProvision = mutation({
  args: {
    clerkId: v.string(),
    desiredUsername: v.optional(v.string()),
    planId: v.optional(v.id("iptvPlans")),
    bouquetIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const existing = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const username = (args.desiredUsername || generateUsernameFromEmail(user.email)).trim();

    const now = Date.now();

    const accountId = existing
      ? existing._id
      : await ctx.db.insert("iptvAccounts", {
          provider: "xtremeui",
          userId: user._id,
          username,
          password: generatePassword(),
          status: "pending",
          planId: args.planId,
          bouquetIds: args.bouquetIds,
          createdAt: now,
          updatedAt: now,
        });

    if (existing) {
      await ctx.db.patch(existing._id, {
        username,
        planId: args.planId,
        bouquetIds: args.bouquetIds,
        status: existing.status === "active" ? "active" : "pending",
        updatedAt: now,
      });
    }

    const jobId = await enqueueJob(ctx, {
      type: "iptv.provision",
      userId: user._id,
      clerkId: args.clerkId,
      payload: {
        accountId,
        planId: args.planId,
        bouquetIds: args.bouquetIds,
      },
    });

    return { accountId, jobId };
  },
});

export const requestSync = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!account) {
      throw new Error("No IPTV account yet");
    }

    const jobId = await enqueueJob(ctx, {
      type: "iptv.sync",
      userId: user._id,
      clerkId: args.clerkId,
      payload: { accountId: account._id },
    });

    return { jobId };
  },
});

export const requestChangePassword = mutation({
  args: { clerkId: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 8) {
      throw new Error("VALIDATION_ERROR: Password must be at least 8 characters");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!account) throw new Error("No IPTV account yet");

    const jobId = await enqueueJob(ctx, {
      type: "iptv.changePassword",
      userId: user._id,
      clerkId: args.clerkId,
      payload: { accountId: account._id, newPassword: args.newPassword },
    });

    return { jobId };
  },
});

export const requestChangePlan = mutation({
  args: { clerkId: v.string(), planId: v.id("iptvPlans") },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!account) throw new Error("No IPTV account yet");

    const jobId = await enqueueJob(ctx, {
      type: "iptv.changePlan",
      userId: user._id,
      clerkId: args.clerkId,
      payload: { accountId: account._id, planId: args.planId },
    });

    return { jobId };
  },
});

// ============================================================
// Xtreme UI API helpers (network calls run in Actions)
// ============================================================

type XtremeUiConfig = {
  apiUrl: string;
  apiKey: string;
  streamBaseUrl: string;
};

export const internalGetXtremeUiConfig = internalQuery({
  args: {},
  handler: async (ctx): Promise<XtremeUiConfig> => {
    const apiUrl = (await getSetting(ctx, "xtreme_ui_url")) || "";
    const apiKey = (await getSetting(ctx, "xtreme_ui_api_key")) || "";
    const streamBaseUrlSetting = await getSetting(ctx, "xtreme_ui_stream_base_url");

    if (!apiUrl || !apiKey) {
      throw new Error("CONFIG_MISSING: Xtreme UI settings not configured");
    }

    const streamBaseUrl = (streamBaseUrlSetting || deriveOriginUrl(apiUrl)).replace(/\/$/, "");
    return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey, streamBaseUrl };
  },
});

export const internalGetAccountForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const internalGetPlanById = internalQuery({
  args: { planId: v.optional(v.id("iptvPlans")) },
  handler: async (ctx, args) => {
    if (!args.planId) return null;
    return await ctx.db.get(args.planId);
  },
});

export const internalEnsureAccountPassword = internalMutation({
  args: { accountId: v.id("iptvAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");
    if (account.password) return { username: account.username, password: account.password };

    const password = generatePassword();
    await ctx.db.patch(args.accountId, { password, updatedAt: Date.now() });
    return { username: account.username, password };
  },
});

function buildM3uUrl(streamBaseUrl: string, username: string, password: string) {
  const base = streamBaseUrl.replace(/\/$/, "");
  return `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(
    password
  )}&type=m3u_plus&output=ts`;
}

async function xtremeApiFetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Xtreme UI API did not return JSON (HTTP ${res.status})`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function xtremeApiCall(config: XtremeUiConfig, params: Record<string, string | number | undefined>) {
  const keyParamCandidates = ["api_key", "key", "apikey"];
  let lastError: string | null = null;

  for (const keyParam of keyParamCandidates) {
    const u = new URL(config.apiUrl);
    u.searchParams.set(keyParam, config.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      u.searchParams.set(k, String(v));
    }

    const json = await xtremeApiFetchJson(u.toString());
    const status = typeof json?.status === "string" ? json.status : undefined;
    const error = typeof json?.error === "string" ? json.error : undefined;

    if (status === "STATUS_FAILURE" && error && /invalid api key/i.test(error)) {
      lastError = "Invalid API key";
      continue;
    }

    return json;
  }

  throw new Error(`CONFIG_MISSING: ${lastError || "Failed to authenticate to Xtreme UI API"}`);
}

function isSuccess(resp: any): boolean {
  if (!resp || typeof resp !== "object") return false;
  if (resp.status === "STATUS_SUCCESS") return true;
  if (resp.status === "STATUS_FAILURE") return false;
  // Some panels return { success: true }
  if (resp.success === true) return true;
  return false;
}

function getErrorMessage(resp: any): string {
  const msg =
    (typeof resp?.error === "string" && resp.error) ||
    (typeof resp?.message === "string" && resp.message) ||
    (typeof resp?.msg === "string" && resp.msg) ||
    "Unknown error";
  return msg;
}

async function upsertUserOnPanel(args: {
  config: XtremeUiConfig;
  username: string;
  password: string;
  bouquetIds?: string[];
  desiredExpiresAt?: number;
  durationDays?: number;
}) {
  const bouquetCsv = args.bouquetIds?.length ? args.bouquetIds.join(",") : undefined;
  const expUnix = typeof args.desiredExpiresAt === "number" ? Math.floor(args.desiredExpiresAt / 1000) : undefined;

  const candidates: Array<Record<string, string | number | undefined>> = [
    // Common XUI/Xtream-style patterns
    {
      action: "user",
      sub: "create",
      username: args.username,
      password: args.password,
      bouquet: bouquetCsv,
      bouquet_ids: bouquetCsv,
      exp_date: expUnix,
      duration: args.durationDays,
    },
    {
      action: "user",
      sub: "add",
      username: args.username,
      password: args.password,
      bouquet: bouquetCsv,
      bouquet_ids: bouquetCsv,
      exp_date: expUnix,
      duration: args.durationDays,
    },
  ];

  let last: any = null;
  for (const p of candidates) {
    const resp = await xtremeApiCall(args.config, p);
    last = resp;
    if (isSuccess(resp)) return resp;

    const err = getErrorMessage(resp);
    if (/exist|already/i.test(err)) {
      // Try an edit/update flow
      break;
    }
  }

  const editCandidates: Array<Record<string, string | number | undefined>> = [
    {
      action: "user",
      sub: "edit",
      username: args.username,
      password: args.password,
      bouquet: bouquetCsv,
      bouquet_ids: bouquetCsv,
      exp_date: expUnix,
      duration: args.durationDays,
    },
    {
      action: "user",
      sub: "update",
      username: args.username,
      password: args.password,
      bouquet: bouquetCsv,
      bouquet_ids: bouquetCsv,
      exp_date: expUnix,
      duration: args.durationDays,
    },
  ];

  for (const p of editCandidates) {
    const resp = await xtremeApiCall(args.config, p);
    last = resp;
    if (isSuccess(resp)) return resp;
  }

  throw new Error(`Xtreme UI provision failed: ${getErrorMessage(last)}`);
}

async function disableUserOnPanel(config: XtremeUiConfig, username: string) {
  const candidates: Array<Record<string, string | number | undefined>> = [
    { action: "user", sub: "disable", username },
    { action: "user", sub: "ban", username },
    { action: "user", sub: "suspend", username },
  ];

  let last: any = null;
  for (const p of candidates) {
    const resp = await xtremeApiCall(config, p);
    last = resp;
    if (isSuccess(resp)) return resp;
  }
  throw new Error(`Xtreme UI suspend failed: ${getErrorMessage(last)}`);
}

async function updateUserOnPanel(config: XtremeUiConfig, params: Record<string, string | number | undefined>) {
  const resp = await xtremeApiCall(config, params);
  if (isSuccess(resp)) return resp;
  throw new Error(`Xtreme UI update failed: ${getErrorMessage(resp)}`);
}

async function updateUserEditLikeOnPanel(
  config: XtremeUiConfig,
  base: Omit<Record<string, string | number | undefined>, "sub"> & { action: string; username: string }
) {
  const subs = ["edit", "update"]; 
  let last: any = null;
  for (const sub of subs) {
    const resp = await xtremeApiCall(config, { ...base, sub });
    last = resp;
    if (isSuccess(resp)) return resp;
  }
  throw new Error(`Xtreme UI update failed: ${getErrorMessage(last)}`);
}

async function renewUserOnPanel(
  config: XtremeUiConfig,
  username: string,
  desiredExpiresAt?: number
) {
  const expUnix = typeof desiredExpiresAt === "number" ? Math.floor(desiredExpiresAt / 1000) : undefined;
  const subs = ["renew", "extend", "edit", "update"]; 
  let last: any = null;
  for (const sub of subs) {
    const resp = await xtremeApiCall(config, {
      action: "user",
      sub,
      username,
      exp_date: expUnix,
      expires: expUnix,
    });
    last = resp;
    if (isSuccess(resp)) return resp;
  }
  throw new Error(`Xtreme UI renew failed: ${getErrorMessage(last)}`);
}

async function fetchUserInfoOnPanel(config: XtremeUiConfig, username: string) {
  const candidates: Array<Record<string, string | number | undefined>> = [
    { action: "user", sub: "info", username },
    { action: "user", sub: "get", username },
    { action: "user", sub: "details", username },
  ];

  let last: any = null;
  for (const p of candidates) {
    const resp = await xtremeApiCall(config, p);
    last = resp;
    if (isSuccess(resp)) return resp;
  }
  // Not all panels support info; treat as non-fatal.
  return last;
}

// ============================================================
// Action job handlers (network + DB apply)
// ============================================================

export const actionProvision = internalAction({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    const config = await ctx.runQuery(internal.iptv.internalGetXtremeUiConfig, {});
    const account = await ctx.runQuery(internal.iptv.internalGetAccountForUser, { userId: args.userId });
    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    const creds = await ctx.runMutation(internal.iptv.internalEnsureAccountPassword, { accountId: account._id });

    const payloadPlanIdRaw = args.payload?.planId;
    const payloadBouquets = args.payload?.bouquetIds;
    const payloadPlanId = typeof payloadPlanIdRaw === "string" ? (payloadPlanIdRaw as Id<"iptvPlans">) : undefined;

    const plan = payloadPlanId
      ? await ctx.runQuery(internal.iptv.internalGetPlanById, { planId: payloadPlanId })
      : account.planId
        ? await ctx.runQuery(internal.iptv.internalGetPlanById, { planId: account.planId })
        : null;

    const bouquetIds = Array.isArray(payloadBouquets)
      ? (payloadBouquets as string[])
      : plan?.bouquetIds || account.bouquetIds || undefined;

    const durationDays = typeof plan?.durationDays === "number" ? plan.durationDays : undefined;
    const desiredExpiresAtRaw = args.payload?.desiredExpiresAt;
    const desiredExpiresAt =
      typeof desiredExpiresAtRaw === "number"
        ? desiredExpiresAtRaw
        : typeof durationDays === "number"
          ? Date.now() + durationDays * 24 * 60 * 60 * 1000
          : undefined;

    await upsertUserOnPanel({
      config,
      username: creds.username,
      password: creds.password,
      bouquetIds,
      desiredExpiresAt,
      durationDays,
    });

    // Apply local state (active + M3U URL + plan/bouquets)
    await ctx.runMutation(internal.iptv.internalProvision, {
      userId: args.userId,
      payload: {
        planId: payloadPlanId,
        bouquetIds,
        desiredExpiresAt,
      },
    });

    // Ensure M3U URL uses stream base (origin) not API path.
    await ctx.runMutation(internal.iptv.internalSync, {
      userId: args.userId,
      payload: {
        streamBaseUrl: config.streamBaseUrl,
        username: creds.username,
        password: creds.password,
      },
    });
  },
});

export const actionRenew = internalAction({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    const config = await ctx.runQuery(internal.iptv.internalGetXtremeUiConfig, {});
    const account = await ctx.runQuery(internal.iptv.internalGetAccountForUser, { userId: args.userId });
    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    const desiredExpiresAt = typeof args.payload?.desiredExpiresAt === "number" ? args.payload.desiredExpiresAt : undefined;
    await renewUserOnPanel(config, account.username, desiredExpiresAt);

    await ctx.runMutation(internal.iptv.internalRenew, {
      userId: args.userId,
      payload: { desiredExpiresAt },
    });
  },
});

export const actionSuspend = internalAction({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");
    const config = await ctx.runQuery(internal.iptv.internalGetXtremeUiConfig, {});
    const account = await ctx.runQuery(internal.iptv.internalGetAccountForUser, { userId: args.userId });
    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    await disableUserOnPanel(config, account.username);
    await ctx.runMutation(internal.iptv.internalSuspend, { userId: args.userId, payload: {} });
  },
});

export const actionSync = internalAction({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");
    const config = await ctx.runQuery(internal.iptv.internalGetXtremeUiConfig, {});
    const account = await ctx.runQuery(internal.iptv.internalGetAccountForUser, { userId: args.userId });
    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    const info = await fetchUserInfoOnPanel(config, account.username);

    // Best-effort: keep local M3U and optionally mirror expiry/status if available.
    await ctx.runMutation(internal.iptv.internalSync, {
      userId: args.userId,
      payload: {
        streamBaseUrl: config.streamBaseUrl,
        panelInfo: info,
      },
    });
  },
});

export const actionChangePassword = internalAction({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");
    const newPassword = args.payload?.newPassword;
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      throw new Error("VALIDATION_ERROR: Invalid password");
    }

    const config = await ctx.runQuery(internal.iptv.internalGetXtremeUiConfig, {});
    const account = await ctx.runQuery(internal.iptv.internalGetAccountForUser, { userId: args.userId });
    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    await updateUserEditLikeOnPanel(config, {
      action: "user",
      username: account.username,
      password: newPassword,
    });

    await ctx.runMutation(internal.iptv.internalChangePassword, {
      userId: args.userId,
      payload: { newPassword, streamBaseUrl: config.streamBaseUrl },
    });
  },
});

export const actionChangePlan = internalAction({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");
    const planIdRaw = args.payload?.planId;
    const planId = typeof planIdRaw === "string" ? (planIdRaw as Id<"iptvPlans">) : undefined;
    if (!planId) throw new Error("VALIDATION_ERROR: Missing planId");

    const config = await ctx.runQuery(internal.iptv.internalGetXtremeUiConfig, {});
    const account = await ctx.runQuery(internal.iptv.internalGetAccountForUser, { userId: args.userId });
    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    const plan = await ctx.runQuery(internal.iptv.internalGetPlanById, { planId });
    const bouquetCsv = plan?.bouquetIds?.length ? plan.bouquetIds.join(",") : undefined;

    await updateUserEditLikeOnPanel(config, {
      action: "user",
      username: account.username,
      bouquet: bouquetCsv,
      bouquet_ids: bouquetCsv,
    });

    await ctx.runMutation(internal.iptv.internalChangePlan, {
      userId: args.userId,
      payload: { planId },
    });
  },
});

// ============================================================
// Internal job handlers
// ============================================================

export const internalProvision = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    // Validate config exists (we won't guess the panel API yet)
    const xtremeUrl = await getSetting(ctx, "xtreme_ui_url");
    const apiKey = await getSetting(ctx, "xtreme_ui_api_key");

    if (!xtremeUrl || !apiKey) {
      throw new Error("CONFIG_MISSING: Xtreme UI settings not configured");
    }

    const streamBaseUrl =
      (await getSetting(ctx, "xtreme_ui_stream_base_url")) || deriveOriginUrl(xtremeUrl);

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();

    if (!account) {
      throw new Error("VALIDATION_ERROR: IPTV account missing");
    }

    if (!account.password) {
      await ctx.db.patch(account._id, {
        password: generatePassword(),
        updatedAt: Date.now(),
      });
    }

    const updatedAccount = await ctx.db.get(account._id);

    // Apply plan/bouquet choices if present in payload
    const payloadPlanIdRaw = args.payload?.planId;
    const payloadBouquets = args.payload?.bouquetIds;
    const payloadPlanId =
      typeof payloadPlanIdRaw === "string"
        ? (payloadPlanIdRaw as Id<"iptvPlans">)
        : undefined;

    if (payloadPlanId || payloadBouquets) {
      let bouquetIds = Array.isArray(payloadBouquets) ? (payloadBouquets as string[]) : undefined;
      if (!bouquetIds && payloadPlanId) {
        const plan = await ctx.db.get(payloadPlanId);
        bouquetIds = plan?.bouquetIds;
      }
      await ctx.db.patch(account._id, {
        planId: payloadPlanId ?? account.planId,
        bouquetIds: bouquetIds ?? account.bouquetIds,
        updatedAt: Date.now(),
      });
    }

    const desiredExpiresAt = args.payload?.desiredExpiresAt;

    const m3uUrl = updatedAccount?.password
      ? `${streamBaseUrl.replace(/\/$/, "")}/get.php?username=${encodeURIComponent(
          updatedAccount.username
        )}&password=${encodeURIComponent(updatedAccount.password)}&type=m3u_plus&output=ts`
      : undefined;

    await ctx.db.patch(account._id, {
      status: "active",
      m3uUrl,
      expiresAt: typeof desiredExpiresAt === "number" ? desiredExpiresAt : account.expiresAt,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      action: "iptv_provisioned",
      actorId: "system",
      targetType: "user",
      targetId: args.userId,
      details: JSON.stringify({ provider: "xtremeui" }),
      timestamp: Date.now(),
    });
  },
});

export const internalRenew = internalMutation({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();

    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    const desiredExpiresAt = args.payload?.desiredExpiresAt;
    // For now we just ensure account stays active. Actual panel extension will be wired once API details are provided.
    await ctx.db.patch(account._id, {
      status: "active",
      expiresAt: typeof desiredExpiresAt === "number" ? desiredExpiresAt : account.expiresAt,
      updatedAt: Date.now(),
    });
  },
});

export const internalSuspend = internalMutation({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();

    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    await ctx.db.patch(account._id, {
      status: "suspended",
      updatedAt: Date.now(),
    });
  },
});

export const internalSync = internalMutation({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    const xtremeUrl = await getSetting(ctx, "xtreme_ui_url");
    if (!xtremeUrl) {
      throw new Error("CONFIG_MISSING: Xtreme UI URL missing");
    }

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();

    if (!account) {
      throw new Error("VALIDATION_ERROR: IPTV account missing");
    }

    // For now: keep M3U URL up-to-date
    const streamBaseUrlOverride = typeof args.payload?.streamBaseUrl === "string" ? args.payload.streamBaseUrl : null;
    const streamBaseUrl =
      streamBaseUrlOverride || (await getSetting(ctx, "xtreme_ui_stream_base_url")) || deriveOriginUrl(xtremeUrl);

    const username = typeof args.payload?.username === "string" ? args.payload.username : account.username;
    const password = typeof args.payload?.password === "string" ? args.payload.password : account.password;

    // Best-effort: mirror some panel info if present
    const panelInfo = args.payload?.panelInfo;
    const inferredExpiresAt =
      typeof panelInfo?.exp_date === "number" ? panelInfo.exp_date * 1000 :
      typeof panelInfo?.expires === "number" ? panelInfo.expires * 1000 :
      undefined;
    const inferredStatus =
      typeof panelInfo?.user_status === "string" ? panelInfo.user_status :
      typeof panelInfo?.status === "string" && (panelInfo.status === "active" || panelInfo.status === "suspended") ? panelInfo.status :
      undefined;

    if (password) {
      const m3uUrl = `${streamBaseUrl.replace(/\/$/, "")}/get.php?username=${encodeURIComponent(
        username
      )}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;

      await ctx.db.patch(account._id, {
        m3uUrl,
        ...(inferredExpiresAt ? { expiresAt: inferredExpiresAt } : {}),
        ...(inferredStatus ? { status: inferredStatus } : {}),
        updatedAt: Date.now(),
      });
    }
  },
});

export const internalChangePassword = internalMutation({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    const newPassword = args.payload?.newPassword;
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      throw new Error("VALIDATION_ERROR: Invalid password");
    }

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();

    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    await ctx.db.patch(account._id, {
      password: newPassword,
      updatedAt: Date.now(),
    });

    // Keep M3U URL consistent
    const streamBaseUrlOverride = typeof args.payload?.streamBaseUrl === "string" ? args.payload.streamBaseUrl : null;
    const xtremeUrl = await getSetting(ctx, "xtreme_ui_url");
    const streamBaseUrl =
      streamBaseUrlOverride || (await getSetting(ctx, "xtreme_ui_stream_base_url")) || (xtremeUrl ? deriveOriginUrl(xtremeUrl) : null);

    if (streamBaseUrl) {
      const m3uUrl = `${streamBaseUrl.replace(/\/$/, "")}/get.php?username=${encodeURIComponent(
        account.username
      )}&password=${encodeURIComponent(newPassword)}&type=m3u_plus&output=ts`;

      await ctx.db.patch(account._id, {
        m3uUrl,
        updatedAt: Date.now(),
      });
    }
  },
});

export const internalChangePlan = internalMutation({
  args: { userId: v.optional(v.id("users")), payload: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("VALIDATION_ERROR: Missing userId");

    const planIdRaw = args.payload?.planId;
    const planId = typeof planIdRaw === "string" ? (planIdRaw as Id<"iptvPlans">) : undefined;
    if (!planId) {
      throw new Error("VALIDATION_ERROR: Missing planId");
    }

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();

    if (!account) throw new Error("VALIDATION_ERROR: IPTV account missing");

    await ctx.db.patch(account._id, {
      planId,
      updatedAt: Date.now(),
    });

    const plan = await ctx.db.get(planId);
    if (plan?.bouquetIds) {
      await ctx.db.patch(account._id, {
        bouquetIds: plan.bouquetIds,
        updatedAt: Date.now(),
      });
    }

    // Bouquet assignment on the actual IPTV panel will be wired once API details are provided.
  },
});

export const internalHandlePaymentStatusChange = internalMutation({
  args: {
    userId: v.id("users"),
    clerkId: v.optional(v.string()),
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
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("VALIDATION_ERROR: User not found");

    const isPaid =
      args.paymentStatus === "active" ||
      args.paymentStatus === "trialing" ||
      args.paymentStatus === "free";

    const isTerminalUnpaid = args.paymentStatus === "canceled" || args.paymentStatus === "unpaid";

    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // If we don't have a real email yet, don't auto-create an IPTV account.
    const hasEmail = typeof user.email === "string" && user.email.includes("@");

    const jobIds: string[] = [];

    if (isPaid) {
      let accountId = account?._id;

      if (!accountId) {
        if (!hasEmail) return { enqueued: false, reason: "missing_email" };

        const now = Date.now();
        accountId = await ctx.db.insert("iptvAccounts", {
          provider: "xtremeui",
          userId: args.userId,
          username: generateUsernameFromEmail(user.email),
          password: generatePassword(),
          status: "pending",
          createdAt: now,
          updatedAt: now,
        });
      }

      // Provision (creates/activates + generates M3U URL)
      const provisionJobId = await enqueueJob(ctx, {
        type: "iptv.provision",
        userId: args.userId,
        clerkId: args.clerkId,
        payload: { accountId },
      });
      jobIds.push(String(provisionJobId));

      // Renew (align expiry with Stripe period end when available)
      if (args.paymentExpiresAt) {
        const renewJobId = await enqueueJob(ctx, {
          type: "iptv.renew",
          userId: args.userId,
          clerkId: args.clerkId,
          payload: { accountId, desiredExpiresAt: args.paymentExpiresAt },
        });
        jobIds.push(String(renewJobId));
      }

      return { enqueued: true, jobIds };
    }

    if (isTerminalUnpaid && account) {
      const suspendJobId = await enqueueJob(ctx, {
        type: "iptv.suspend",
        userId: args.userId,
        clerkId: args.clerkId,
        payload: { accountId: account._id },
      });
      jobIds.push(String(suspendJobId));
      return { enqueued: true, jobIds };
    }

    return { enqueued: false };
  },
});

// Helper used by payment/donation flows to enqueue sync/provision as needed.
export const enqueueSyncIfAccountExists = internalMutation({
  args: { userId: v.id("users"), clerkId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("iptvAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account) return { enqueued: false };

    const jobId = await enqueueJob(ctx, {
      type: "iptv.sync",
      userId: args.userId,
      clerkId: args.clerkId,
      payload: { accountId: account._id },
    });

    return { enqueued: true, jobId };
  },
});
