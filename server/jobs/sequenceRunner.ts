/**
 * Sequence Runner — Background Job für automatisierte Follow-up Emails.
 * Läuft alle 5 Minuten, prüft ausstehende Sequence Steps und sendet Emails.
 * Dependencies: Supabase, OpenAI, Resend
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, RESEND_API_KEY
 *
 * Uses Supabase Advisory Locks to prevent duplicate execution across multiple worker instances.
 * Uses idempotency keys to prevent duplicate email sends.
 */

import { admin } from "../supabaseAdmin.js";
import {
  generateEmailFromTemplate,
  shouldExecuteStep,
  calculateNextSendAt,
} from "../pipeline/sequenceEngine.js";
import { logEvent, makeRequestId } from "../lib/logger.js";
import { EntitlementDb } from "../db.js";
import { Pool } from "pg";

// Advisory Lock IDs (must be unique per job type)
const SEQUENCE_RUNNER_LOCK_ID = 123456789; // Unique bigint for sequence runner
const IDEMPOTENCY_TABLE = "job_idempotency";

type AccountTier = "solo" | "team" | "agency";
const TIER_LIMITS: Record<AccountTier, any> = {
  solo: { monthlySends: 50 },
  team: { monthlySends: 500 },
  agency: { monthlySends: -1 },
};

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getWorkspaceTier(workspaceId: string): Promise<AccountTier> {
  if (!admin) return "solo";
  const { data } = await admin
    .from("workspaces")
    .select("plan_tier")
    .eq("id", workspaceId)
    .single();
  return (data?.plan_tier as AccountTier) ?? "solo";
}

interface SequenceJobStats {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Initialize idempotency table if it doesn't exist
 */
async function ensureIdempotencyTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${IDEMPOTENCY_TABLE} (
      idempotency_key TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  
  // Clean up expired keys periodically
  await pool.query(`
    DELETE FROM ${IDEMPOTENCY_TABLE} 
    WHERE expires_at < now()
  `);
}

/**
 * Check and record idempotency key
 * Returns true if the operation should proceed (key is new)
 */
async function checkAndSetIdempotency(
  pool: Pool,
  key: string,
  jobType: string,
  workspaceId: string,
  ttlSeconds: number = 3600
): Promise<boolean> {
  try {
    const result = await pool.query(`
      INSERT INTO ${IDEMPOTENCY_TABLE} (idempotency_key, job_type, workspace_id, expires_at)
      VALUES ($1, $2, $3, now() + interval '${ttlSeconds} seconds')
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key
    `, [key, jobType, workspaceId]);
    
    return result.rowCount !== null && result.rowCount > 0;
  } catch (err) {
    logEvent("error", "idempotency_check_failed", {
      requestId: makeRequestId(),
      error: String(err),
      idempotencyKey: key,
    });
    // Fail open - allow the operation
    return true;
  }
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
      logEvent("info", "advisory_lock_acquired", {
        requestId,
        lockId,
      });
    } else {
      logEvent("info", "advisory_lock_not_acquired", {
        requestId,
        lockId,
        reason: "Another instance holds the lock",
      });
    }
    
    return acquired;
  } catch (err) {
    logEvent("error", "advisory_lock_error", {
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
    logEvent("info", "advisory_lock_released", {
      requestId,
      lockId,
    });
  } catch (err) {
    logEvent("error", "advisory_unlock_error", {
      requestId,
      lockId,
      error: String(err),
    });
  }
}

/**
 * Haupt-Runner-Funktion - called by worker with advisory lock
 */
export async function runSequenceProcessor(): Promise<SequenceJobStats> {
  const runId = makeRequestId();
  const stats: SequenceJobStats = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    if (!admin) {
      logEvent("error", "sequence_runner_no_supabase", {
        runId,
        error: "Supabase admin client not configured",
      });
      return stats;
    }

    // Get a direct PostgreSQL connection for advisory locks
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logEvent("error", "sequence_runner_no_db_url", {
        runId,
        error: "DATABASE_URL not configured",
      });
      return stats;
    }

    const pool = new Pool({ connectionString: databaseUrl });
    
    try {
      // Ensure idempotency table exists
      await ensureIdempotencyTable(pool);

      // Try to acquire advisory lock
      const lockAcquired = await acquireAdvisoryLock(pool, SEQUENCE_RUNNER_LOCK_ID, runId);
      
      if (!lockAcquired) {
        // Another worker instance is running this job
        logEvent("info", "sequence_runner_skipped_locked", {
          runId,
          lockId: SEQUENCE_RUNNER_LOCK_ID,
        });
        return stats;
      }

      // Process enrollments with lock held
      const result = await processSequenceEnrollments(runId, stats, pool);
      
      // Release the lock
      await releaseAdvisoryLock(pool, SEQUENCE_RUNNER_LOCK_ID, runId);
      
      return result;
    } finally {
      await pool.end();
    }
  } catch (err) {
    logEvent("error", "sequence_runner_unexpected_error", {
      runId,
      error: String(err),
    });
    return stats;
  }
}

/**
 * Process sequence enrollments with advisory lock held
 */
async function processSequenceEnrollments(
  runId: string,
  stats: SequenceJobStats,
  pool: Pool
): Promise<SequenceJobStats> {
  try {
    // Hole alle aktiven Enrollments die jetzt ausgeführt werden sollen
    const { data: enrollments, error: enrollmentError } = await admin!
      .from("sequence_enrollments")
      .select(
        `
        id,
        lead_id,
        sequence_id,
        current_step,
        status,
        next_send_at,
        sequences!inner (
          id,
          workspace_id,
          name,
          steps,
          is_active
        ),
        leads!inner (
          id,
          personal,
          organization,
          extraction,
          newsletter
        )
      `
      )
      .eq("status", "active")
      .lte("next_send_at", new Date().toISOString())
      .eq("sequences.is_active", true);

    if (enrollmentError) {
      logEvent("error", "sequence_runner_fetch_enrollments", {
        runId,
        error: String(enrollmentError),
      });
      return stats;
    }

    if (!enrollments || enrollments.length === 0) {
      return stats; // Keine ausstehenden Enrollments
    }

    logEvent("info", "sequence_runner_processing", {
      runId,
      enrollmentCount: enrollments.length,
    });

    // Verarbeite jede Enrollment
    for (const enrollment of enrollments) {
      stats.processed++;

      try {
        await processEnrollment(enrollment, stats, runId, pool);
      } catch (err) {
        stats.failed++;
        logEvent("error", "sequence_runner_enrollment_failed", {
          runId,
          enrollmentId: enrollment.id,
          error: String(err),
        });
      }
    }

    logEvent("info", "sequence_runner_completed", { runId, ...stats });
    return stats;
  } catch (err) {
    logEvent("error", "sequence_runner_processing_error", {
      runId,
      error: String(err),
    });
    return stats;
  }
}

/**
 * Verarbeitet eine einzelne Enrollment mit Idempotency
 */
async function processEnrollment(
  enrollment: any,
  stats: SequenceJobStats,
  runId: string,
  pool: Pool
): Promise<void> {
  const sequence = enrollment.sequences;
  const lead = enrollment.leads;
  const steps = sequence.steps as any[];

  // Create idempotency key for this enrollment + step
  const idempotencyKey = `seq_enroll_${enrollment.id}_step_${enrollment.current_step}_${new Date().toISOString().split('T')[0]}`;

  // Check idempotency
  const shouldProceed = await checkAndSetIdempotency(
    pool,
    idempotencyKey,
    "sequence_send",
    sequence.workspace_id,
    86400 // 24 hours TTL
  );

  if (!shouldProceed) {
    logEvent("info", "sequence_send_idempotent_skip", {
      runId,
      enrollmentId: enrollment.id,
      idempotencyKey,
    });
    stats.skipped++;
    return;
  }

  // Entitlement Check
  const entitlementDb = new EntitlementDb({ databaseUrl: process.env.DATABASE_URL });
  if (entitlementDb.isConfigured) {
    const workspaceTier = await getWorkspaceTier(sequence.workspace_id);
    const limits = TIER_LIMITS[workspaceTier];
    const usageMonth = getCurrentMonthKey();
    const consumed = await entitlementDb.consumeWorkspaceEntitlement({
      workspaceId: sequence.workspace_id,
      tier: workspaceTier,
      usageMonth,
      feature: "sends",
      limits,
    });
    if (!consumed.allowed) {
      logEvent("warn", "sequence_send_limit_reached", {
        workspaceId: sequence.workspace_id,
        tier: workspaceTier,
        sendsUsed: consumed.usage.sends,
        monthlySends: limits.sends,
      });
      stats.skipped++;
      return;
    }
  }

  // Finde den aktuellen Step
  const currentStep = steps.find(
    step => step.stepNumber === enrollment.current_step
  );
  if (!currentStep) {
    // Kein Step gefunden -> Enrollment abschließen
    await completeEnrollment(enrollment.id);
    stats.skipped++;
    return;
  }

  // Prüfe ob der Step ausgeführt werden soll
  const lastEmailEvent = await getLastEmailEvent(enrollment.lead_id);
  if (!shouldExecuteStep(enrollment, currentStep, lastEmailEvent)) {
    stats.skipped++;
    return;
  }

  // Hole Workspace-Daten für Business Description
  const { data: workspace } = await admin!
    .from("workspaces")
    .select("name")
    .eq("id", sequence.workspace_id)
    .single();

  const businessDescription = workspace?.name || "B2B Business";
  const senderName = "Skerry";

  // Generiere Email aus Template
  const emailTemplate = await generateEmailFromTemplate(
    currentStep,
    lead,
    businessDescription,
    senderName
  );

  // Sende Email mit Idempotency
  const sendResult = await sendSequenceEmail(
    enrollment.lead_id,
    enrollment.sequence_id,
    enrollment.id,
    emailTemplate,
    sequence.workspace_id,
    idempotencyKey // Pass idempotency key to prevent duplicate sends
  );

  if (sendResult.success) {
    stats.sent++;

    // Berechne nächsten Step
    const nextStep = steps.find(
      step => step.stepNumber === enrollment.current_step + 1
    );
    if (nextStep) {
      // Nächsten Step planen
      const nextSendAt = calculateNextSendAt(nextStep, new Date());
      await admin!
        .from("sequence_enrollments")
        .update({
          current_step: nextStep.stepNumber,
          next_send_at: nextSendAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);
    } else {
      // Sequence abgeschlossen
      await completeEnrollment(enrollment.id);
    }
  } else {
    stats.failed++;
  }
}

/**
 * Holt das letzte Email-Event für einen Lead
 */
async function getLastEmailEvent(
  leadId: string
): Promise<{ type: string; createdAt: Date } | undefined> {
  const { data: emailSend } = await admin!
    .from("email_sends")
    .select("events, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!emailSend || !emailSend.events) {
    return undefined;
  }

  const events = emailSend.events as any[];
  const latestEvent = events[events.length - 1];

  return {
    type: latestEvent.type,
    createdAt: new Date(latestEvent.createdAt),
  };
}

/**
 * Sendet eine Sequence-Email mit Idempotency
 */
async function sendSequenceEmail(
  leadId: string,
  sequenceId: string,
  enrollmentId: string,
  emailTemplate: any,
  workspaceId: string,
  idempotencyKey?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.SKERRY_FROM_EMAIL || "Skerry <onboarding@resend.dev>";

    if (!resendKey) {
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    // Hole Lead-Email
    const { data: lead } = await admin!
      .from("leads")
      .select("personal")
      .eq("id", leadId)
      .single();

    const recipientEmail = lead?.personal?.email;
    if (!recipientEmail) {
      return { success: false, error: "Lead has no email address" };
    }

    // Check for existing send with same idempotency key
    if (idempotencyKey) {
      const { data: existingSend } = await admin!
        .from("email_sends")
        .select("provider_message_id, status")
        .eq("idempotency_key", idempotencyKey)
        .single();
      
      if (existingSend) {
        logEvent("info", "email_send_idempotent_skip", {
          requestId: makeRequestId(),
          idempotencyKey,
          existingMessageId: existingSend.provider_message_id,
        });
        return { 
          success: true, 
          messageId: existingSend.provider_message_id,
          error: "Duplicate send prevented by idempotency key"
        };
      }
    }

    // Sende Email via Resend
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        subject: emailTemplate.subject,
        html: markdownToHtml(emailTemplate.body),
        text: markdownToText(emailTemplate.body),
      }),
    });

    if (!resp.ok) {
      const errorData = (await resp.json()) as { message?: string };
      return { success: false, error: errorData.message || "Send failed" };
    }

    const sendData = (await resp.json()) as { id: string };

    // Speichere Email-Send Record mit Idempotency Key
    await admin!.from("email_sends").insert({
      lead_id: leadId,
      sequence_enrollment_id: enrollmentId,
      workspace_id: workspaceId,
      recipient_email: recipientEmail,
      subject: emailTemplate.subject,
      body: emailTemplate.body,
      provider: "resend",
      provider_message_id: sendData.id,
      idempotency_key: idempotencyKey, // Store idempotency key
      status: "sent",
      sent_at: new Date().toISOString(),
      events: [
        {
          type: "sent",
          createdAt: new Date().toISOString(),
          data: { messageId: sendData.id },
        },
      ],
    });

    return { success: true, messageId: sendData.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Schließt eine Enrollment ab
 */
async function completeEnrollment(enrollmentId: string): Promise<void> {
  await admin!
    .from("sequence_enrollments")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);
}

/**
 * Markdown zu HTML Konverter (einfache Version)
 */
function markdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(
      /^# (.+)$/gm,
      '<h1 style="font-size:24px;margin:0 0 16px;color:#0a1628;">$1</h1>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.18em;margin:24px 0 8px;color:#0891b2;">$1</h2>'
    )
    .replace(
      /^> (.+)$/gm,
      '<blockquote style="border-left:3px solid #06b6d4;padding-left:12px;color:#475569;margin:16px 0;">$1</blockquote>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /^---$/gm,
      '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />'
    );

  html = html
    .split(/\n{2,}/)
    .map(para =>
      /^\s*<(h1|h2|blockquote|hr)/.test(para)
        ? para
        : `<p style="margin:0 0 12px;line-height:1.5;color:#1e293b;">${para.replace(/\n/g, "<br/>")}</p>`
    )
    .join("\n");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;">${html}</div>`;
}

/**
 * Markdown zu Text Konverter
 */
function markdownToText(md: string): string {
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^---$/gm, "");
}

/**
 * Startet den Sequence Runner als Background Job mit Advisory Lock
 * This function is called by the worker process
 */
export async function startSequenceRunner(): Promise<void> {
  const interval = 5 * 60 * 1000; // 5 minutes

  logEvent("info", "sequence_runner_started", {
    requestId: makeRequestId(),
    interval,
    mode: "advisory_lock",
  });

  // Run immediately on start
  await runSequenceProcessor().catch(err => {
    logEvent("error", "sequence_runner_initial_failed", {
      requestId: makeRequestId(),
      error: String(err),
    });
  });

  // Then run on interval
  setInterval(async () => {
    try {
      const stats = await runSequenceProcessor();

      // Log nur wenn etwas passiert ist
      if (stats.processed > 0) {
        logEvent("info", "sequence_runner_cycle_completed", {
          requestId: makeRequestId(),
          ...stats,
        });
      }
    } catch (err) {
      logEvent("error", "sequence_runner_cycle_failed", {
        requestId: makeRequestId(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, interval);
}
