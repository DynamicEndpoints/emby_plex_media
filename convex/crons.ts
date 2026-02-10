import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process scheduled revocations every hour
crons.interval(
  "process-scheduled-revocations",
  { hours: 1 },
  internal.revocations.processScheduledRevocations
);

// Sync Stripe subscriptions daily to catch any missed webhooks
crons.daily(
  "sync-stripe-subscriptions",
  { hourUTC: 3, minuteUTC: 0 }, // Run at 3 AM UTC
  internal.revocations.syncSubscriptionStatuses
);

// Process background jobs (IPTV provisioning/sync/etc.) every minute
crons.interval(
  "process-background-jobs",
  { minutes: 1 },
  internal.jobs.processDueJobs,
  { batchSize: 10, runnerId: "cron" }
);

export default crons;
