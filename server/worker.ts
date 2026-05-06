/**
 * Skerry Worker — separate process for background jobs.
 *
 * Runs independently from the main API server for better enterprise reliability.
 * Background jobs:
 *   - Sequence Runner: every 5 minutes (sends follow-up emails)
 *   - GDPR Processor: every 24 hours (processes deletion requests)
 *
 * Usage:
 *   node dist/worker.js
 *
 * Env vars (same as server):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY, RESEND_API_KEY
 *   DATABASE_URL, SESSION_SECRET
 *   NODE_ENV=production
 */

import "dotenv/config";
import { startSequenceRunner } from "./jobs/sequenceRunner.js";
import { startGdprProcessor } from "./jobs/gdprProcessor.js";
import { logEvent, makeRequestId } from "./lib/logger.js";

logEvent("info", "worker_started", {
  requestId: makeRequestId(),
  pid: process.pid,
});

// Start all background jobs
startSequenceRunner();
startGdprProcessor();

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logEvent("info", "worker_SIGTERM_received", {
    requestId: makeRequestId(),
  });
  process.exit(0);
});

process.on("SIGINT", () => {
  logEvent("info", "worker_SIGINT_received", {
    requestId: makeRequestId(),
  });
  process.exit(0);
});
