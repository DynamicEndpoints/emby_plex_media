import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

function now() {
  return Date.now();
}

function backoffMs(attempts: number): number {
  // Exponential backoff with a small cap so jobs eventually settle.
  const base = 60_000; // 1m
  const cap = 60 * 60_000; // 1h
  return Math.min(cap, base * Math.pow(2, Math.max(0, attempts - 1)));
}

function isNonRetryableErrorMessage(message: string): boolean {
  return (
    message.startsWith("CONFIG_MISSING") ||
    message.startsWith("NOT_IMPLEMENTED") ||
    message.startsWith("VALIDATION_ERROR")
  );
}

export const enqueue = mutation({
  args: {
    type: v.string(),
    payload: v.optional(v.any()),
    userId: v.optional(v.id("users")),
    clerkId: v.optional(v.string()),
    runAt: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", {
      type: args.type,
      status: "pending",
      userId: args.userId,
      clerkId: args.clerkId,
      payload: args.payload ? JSON.stringify(args.payload) : undefined,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? 10,
      nextRunAt: args.runAt ?? now(),
      createdAt: now(),
      updatedAt: now(),
    });

    return jobId;
  },
});

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listMyJobs = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    return await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

export const cancelJob = mutation({
  args: {
    id: v.id("jobs"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Job not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || !job.userId || job.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    if (job.status === "succeeded" || job.status === "failed") {
      return { canceled: false, reason: "already_finished" };
    }

    await ctx.db.patch(job._id, {
      status: "canceled",
      updatedAt: now(),
    });

    return { canceled: true };
  },
});

export const internalGetDueJobs = internalQuery({
  args: {
    batchSize: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_status_next_run", (q) =>
        q.eq("status", "pending").lte("nextRunAt", args.now)
      )
      .order("asc")
      .take(args.batchSize);
  },
});

export const internalLockJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
    runnerId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return { locked: false, reason: "missing" };
    if (job.status !== "pending") return { locked: false, reason: "not_pending" };
    if (job.nextRunAt > args.now) return { locked: false, reason: "not_due" };

    await ctx.db.patch(args.jobId, {
      status: "running",
      lockedAt: args.now,
      lockedBy: args.runnerId,
      updatedAt: args.now,
      lastAttemptAt: args.now,
    });
    return { locked: true };
  },
});

export const internalMarkSucceeded = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "succeeded",
      updatedAt: now(),
      lastError: undefined,
      lockedAt: undefined,
      lockedBy: undefined,
    });
  },
});

export const internalMarkFailedOrRetry = internalMutation({
  args: {
    jobId: v.id("jobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const message = args.errorMessage;
    const attempts = (job.attempts ?? 0) + 1;
    const nonRetryable = isNonRetryableErrorMessage(message);
    const outOfAttempts = attempts >= job.maxAttempts;

    if (nonRetryable || outOfAttempts) {
      await ctx.db.patch(args.jobId, {
        status: "failed",
        attempts,
        lastError: message,
        updatedAt: now(),
        lockedAt: undefined,
        lockedBy: undefined,
      });
    } else {
      await ctx.db.patch(args.jobId, {
        status: "pending",
        attempts,
        lastError: message,
        nextRunAt: now() + backoffMs(attempts),
        updatedAt: now(),
        lockedAt: undefined,
        lockedBy: undefined,
      });
    }
  },
});

export const processDueJobs = internalAction({
  args: {
    batchSize: v.optional(v.number()),
    runnerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? 10, 1), 50);
    const runnerId = args.runnerId ?? "cron";
    const currentTime = now();

    const due = await ctx.runQuery(internal.jobs.internalGetDueJobs, {
      batchSize,
      now: currentTime,
    });

    let processed = 0;

    for (const job of due) {
      const lock = await ctx.runMutation(internal.jobs.internalLockJob, {
        jobId: job._id,
        runnerId,
        now: currentTime,
      });
      if (!lock.locked) continue;

      const payload = job.payload ? safeJsonParse(job.payload) : undefined;

      try {
        await dispatchJobAction(ctx, job.type, payload, job.userId);
        await ctx.runMutation(internal.jobs.internalMarkSucceeded, { jobId: job._id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await ctx.runMutation(internal.jobs.internalMarkFailedOrRetry, {
          jobId: job._id,
          errorMessage: message,
        });
      }

      processed++;
    }

    return { processed };
  },
});

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function dispatchJobAction(
  ctx: any,
  type: string,
  payload: any,
  userId?: any
): Promise<void> {
  switch (type) {
    case "iptv.provision":
      await ctx.runAction(internal.iptv.actionProvision, { userId, payload });
      return;
    case "iptv.renew":
      await ctx.runAction(internal.iptv.actionRenew, { userId, payload });
      return;
    case "iptv.suspend":
      await ctx.runAction(internal.iptv.actionSuspend, { userId, payload });
      return;
    case "iptv.sync":
      await ctx.runAction(internal.iptv.actionSync, { userId, payload });
      return;
    case "iptv.changePassword":
      await ctx.runAction(internal.iptv.actionChangePassword, { userId, payload });
      return;
    case "iptv.changePlan":
      await ctx.runAction(internal.iptv.actionChangePlan, { userId, payload });
      return;
    default:
      throw new Error(`NOT_IMPLEMENTED: Unknown job type: ${type}`);
  }
}
