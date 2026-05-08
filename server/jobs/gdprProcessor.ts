/**
 * GDPR Processor - Background Job für automatische Löschfristen-Verarbeitung.
 * Läuft täglich und prüft fällige Löschanträge.
 * Dependencies: Supabase
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 *
 * Uses Supabase Advisory Locks to prevent duplicate execution across multiple worker instances.
 */

import { processDeletionRequests } from "../pipeline/gdprService.js";
import { logEvent, makeRequestId } from "../lib/logger.js";
import { Pool } from "pg";

// Advisory Lock ID for GDPR Processor (must be unique per job type)
const GDPR_PROCESSOR_LOCK_ID = 987654321; // Unique bigint for GDPR processor

interface GdprProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

/**
 * Acquire Supabase Advisory Lock using pg_try_advisory_lock
 * Returns true if lock was acquired
 */
async function acquireAdvisoryLock(
  pool: Pool,
  lockId: number,
  requestId: string
): Promise<boolean> {
  try {
    const result = await pool.query(
      "SELECT pg_try_advisory_lock($1) as acquired",
      [lockId]
    );
    const acquired = result.rows[0]?.acquired ?? false;
    
    if (acquired) {
      logEvent("info", "gdpr_advisory_lock_acquired", {
        requestId,
        lockId,
      });
    } else {
      logEvent("info", "gdpr_advisory_lock_not_acquired", {
        requestId,
        lockId,
        reason: "Another instance holds the lock",
      });
    }
    
    return acquired;
  } catch (err) {
    logEvent("error", "gdpr_advisory_lock_error", {
      requestId,
      lockId,
      error: String(err),
    });
    return false;
  }
}

/**
 * Release Supabase Advisory Lock
 */
async function releaseAdvisoryLock(
  pool: Pool,
  lockId: number,
  requestId: string
): Promise<void> {
  try {
    await pool.query("SELECT pg_advisory_unlock($1)", [lockId]);
    logEvent("info", "gdpr_advisory_lock_released", {
      requestId,
      lockId,
    });
  } catch (err) {
    logEvent("error", "gdpr_advisory_unlock_error", {
      requestId,
      lockId,
      error: String(err),
    });
  }
}

/**
 * Main GDPR Processor function - called by worker with advisory lock
 * Uses advisory locks to prevent concurrent execution across worker instances
 */
export async function runGdprProcessor(): Promise<GdprProcessResult> {
  const runId = makeRequestId();
  const result: GdprProcessResult = {
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logEvent("error", "gdpr_processor_no_db_url", {
        runId,
        error: "DATABASE_URL not configured",
      });
      return result;
    }

    const pool = new Pool({ connectionString: databaseUrl });
    
    try {
      // Try to acquire advisory lock
      const lockAcquired = await acquireAdvisoryLock(pool, GDPR_PROCESSOR_LOCK_ID, runId);
      
      if (!lockAcquired) {
        // Another worker instance is running this job
        logEvent("info", "gdpr_processor_skipped_locked", {
          runId,
          lockId: GDPR_PROCESSOR_LOCK_ID,
        });
        return result;
      }

      // Process deletion requests with lock held
      const processResult = await processDeletionRequests();
      
      result.processed = processResult.processed || 0;
      result.failed = processResult.failed || 0;
      
      // Release the lock
      await releaseAdvisoryLock(pool, GDPR_PROCESSOR_LOCK_ID, runId);
      
      if (result.processed > 0 || result.failed > 0) {
        logEvent("info", "gdpr_processor_completed", {
          runId,
          ...result,
        });
      }
      
      return result;
    } finally {
      await pool.end();
    }
  } catch (err) {
    logEvent("error", "gdpr_processor_unexpected_error", {
      runId,
      error: String(err),
    });
    return result;
  }
}

/**
 * Startet den GDPR Processor als täglichen Background Job mit Advisory Lock
 * This function is called by the worker process
 */
export async function startGdprProcessor(): Promise<void> {
  const interval = 24 * 60 * 60 * 1000; // 24 hours

  logEvent("info", "gdpr_processor_started", {
    requestId: makeRequestId(),
    interval,
    mode: "advisory_lock",
  });

  // Run immediately on start
  await runGdprProcessor().catch(err => {
    logEvent("error", "gdpr_processor_initial_failed", {
      requestId: makeRequestId(),
      error: String(err),
    });
  });

  // Then run on interval
  setInterval(async () => {
    try {
      const result = await runGdprProcessor();

      // Log nur wenn etwas passiert ist
      if (result.processed > 0 || result.failed > 0) {
        logEvent("info", "gdpr_processor_cycle_completed", {
          requestId: makeRequestId(),
          ...result,
        });
      }
    } catch (err) {
      logEvent("error", "gdpr_processor_cycle_failed", {
        requestId: makeRequestId(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, interval);
}
