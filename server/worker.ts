/**
 * Skerry Worker — separate process for background jobs.
 *
 * Runs independently from the main API server for better enterprise reliability.
 * Background jobs:
 *   - Sequence Runner: every 5 minutes (sends follow-up emails)
 *   - GDPR Processor: every 24 hours (processes deletion requests)
 *
 * Uses Supabase Advisory Locks to prevent duplicate execution across multiple instances.
 * Uses idempotency keys to prevent duplicate email sends.
 *
 * Usage:
 *   node dist/worker.js
 *   or
 *   npm run worker
 *
 * Env vars (same as server):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY, RESEND_API_KEY
 *   DATABASE_URL, SESSION_SECRET
 *   NODE_ENV=production
 */

import "dotenv/config";
import { runSequenceProcessor, startSequenceRunner } from "./jobs/sequenceRunner.js";
import { runGdprProcessor, startGdprProcessor } from "./jobs/gdprProcessor.js";
import { logEvent, makeRequestId } from "./lib/logger.js";

const WORKER_TYPE = process.env.WORKER_TYPE || "all"; // "sequence", "gdpr", or "all"

logEvent("info", "worker_started", {
  requestId: makeRequestId(),
  pid: process.pid,
  workerType: WORKER_TYPE,
  mode: "advisory_lock",
});

// Handle graceful shutdown
let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logEvent("info", "worker_shutdown_started", {
    requestId: makeRequestId(),
    signal,
    pid: process.pid,
  });
  
  // Give in-flight jobs time to complete (max 30 seconds)
  setTimeout(() => {
    logEvent("info", "worker_shutdown_complete", {
      requestId: makeRequestId(),
      pid: process.pid,
    });
    process.exit(0);
  }, 30000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  logEvent("error", "worker_unhandled_rejection", {
    requestId: makeRequestId(),
    reason: String(reason),
    promise: String(promise),
  });
});

process.on("uncaughtException", (err) => {
  logEvent("error", "worker_uncaught_exception", {
    requestId: makeRequestId(),
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Start background jobs based on WORKER_TYPE
async function startWorker(): Promise<void> {
  logEvent("info", "worker_initializing", {
    requestId: makeRequestId(),
    workerType: WORKER_TYPE,
  });

  if (WORKER_TYPE === "sequence" || WORKER_TYPE === "all") {
    logEvent("info", "worker_starting_sequence_runner", {
      requestId: makeRequestId(),
    });
    startSequenceRunner();
  }

  if (WORKER_TYPE === "gdpr" || WORKER_TYPE === "all") {
    logEvent("info", "worker_starting_gdpr_processor", {
      requestId: makeRequestId(),
    });
    startGdprProcessor();
  }

  // Health check endpoint for orchestrator (optional, can be disabled)
  if (process.env.WORKER_HEALTH_CHECK !== "false") {
    const http = await import("http");
    const healthPort = process.env.WORKER_HEALTH_PORT || "3002";
    
    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          ok: true, 
          pid: process.pid,
          workerType: WORKER_TYPE,
          uptime: process.uptime(),
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    server.listen(Number(healthPort), () => {
      logEvent("info", "worker_health_check_started", {
        requestId: makeRequestId(),
        port: healthPort,
      });
    });
  }

  logEvent("info", "worker_ready", {
    requestId: makeRequestId(),
    pid: process.pid,
  });
}

// Run the worker
startWorker().catch(err => {
  logEvent("error", "worker_startup_failed", {
    requestId: makeRequestId(),
    error: String(err),
  });
  process.exit(1);
});
