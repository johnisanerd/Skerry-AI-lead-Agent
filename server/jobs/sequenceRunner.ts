/**
 * Sequence Runner — Background Job für automatisierte Follow-up Emails.
 * Läuft alle 5 Minuten, prüft ausstehende Sequence Steps und sendet Emails.
 * Dependencies: Supabase, OpenAI, Resend
 * Env: SUPABASE_URL, OPENAI_API_KEY, RESEND_API_KEY
 */

import { admin } from "../supabaseAdmin.js";
import {
  generateEmailFromTemplate,
  shouldExecuteStep,
  calculateNextSendAt,
} from "../pipeline/sequenceEngine.js";
import { logEvent, makeRequestId } from "../lib/logger.js";
import { EntitlementDb } from "../db.js";

// Import from server/index.ts or define locally
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
 * Haupt-Runner-Funktion - wird alle 5 Minuten aufgerufen
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
        await processEnrollment(enrollment, stats);
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
    logEvent("error", "sequence_runner_unexpected_error", {
      runId,
      error: String(err),
    });
    return stats;
  }
}

/**
 * Verarbeitet eine einzelne Enrollment
 */
async function processEnrollment(
  enrollment: any,
  stats: SequenceJobStats
): Promise<void> {
  const sequence = enrollment.sequences;
  const lead = enrollment.leads;
  const steps = sequence.steps as any[];

  // Entitlement Check
  const entitlementDb = new EntitlementDb({ databaseUrl: process.env.DATABASE_URL });
  if (entitlementDb.isConfigured) {
    const workspaceTier = await getWorkspaceTier(sequence.workspace_id); // Need to define this
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

  // Sende Email
  const sendResult = await sendSequenceEmail(
    enrollment.lead_id,
    enrollment.sequence_id,
    enrollment.id,
    emailTemplate,
    sequence.workspace_id
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
 * Sendet eine Sequence-Email
 */
async function sendSequenceEmail(
  leadId: string,
  sequenceId: string,
  enrollmentId: string,
  emailTemplate: any,
  workspaceId: string
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

    // Speichere Email-Send Record
    await admin!.from("email_sends").insert({
      lead_id: leadId,
      sequence_enrollment_id: enrollmentId,
      workspace_id: workspaceId,
      recipient_email: recipientEmail,
      subject: emailTemplate.subject,
      body: emailTemplate.body,
      provider: "resend",
      provider_message_id: sendData.id,
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /^# (.+)$/gm,
      '<h1 style="font-size:24px;margin:0 0 16px;color:#0a1628;">$1</h1>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.18em;margin:24px 0 8px;color:#0891b2;">$1</h2>'
    )
    .replace(
      /^&gt; (.+)$/gm,
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
 * Startet den Sequence Runner als Background Job
 */
export function startSequenceRunner(): void {
  // Alle 5 Minuten ausführen (300000 ms)
  const interval = 5 * 60 * 1000;

  logEvent("info", "sequence_runner_started", {
    requestId: makeRequestId(),
    interval,
  });

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
