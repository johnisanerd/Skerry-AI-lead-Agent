/**
 * GDPR Service - implementiert DSGVO-Anforderungen für EU-Kunden.
 * Dependencies: Supabase
 * Env: SUPABASE_URL
 */

import { admin } from "../supabaseAdmin.js";
import { logEvent, makeRequestId } from "../lib/logger.js";

export interface DeletionRequest {
  id: string;
  workspaceId: string;
  leadId: string;
  userEmail: string;
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  processedAt?: string;
  deletionDeadline: string;
  metadata: Record<string, unknown>;
}

/**
 * Erstellt einen Löschantrag für einen Lead (DSGVO Art. 17)
 */
export async function createDeletionRequest(params: {
  workspaceId: string;
  leadId: string;
  userEmail: string;
  requestSource: "user_request" | "bounce" | "complaint";
}): Promise<string | null> {
  if (!admin) throw new Error("Supabase admin client not configured");
  const requestId = makeRequestId();

  try {
    // Prüfe ob bereits ein Löschantrag existiert
    const { data: existing } = await admin
      .from("deletion_requests")
      .select("id")
      .eq("lead_id", params.leadId)
      .eq("status", "pending")
      .single();

    if (existing) {
      return existing.id; // Bereits vorhanden
    }

    // Erstelle neuen Löschantrag
    const deletionDeadline = new Date();
    deletionDeadline.setDate(deletionDeadline.getDate() + 30); // 30 Tage Frist

    const { data, error } = await admin
      .from("deletion_requests")
      .insert({
        workspace_id: params.workspaceId,
        lead_id: params.leadId,
        user_email: params.userEmail,
        status: "pending",
        request_source: params.requestSource,
        deletion_deadline: deletionDeadline.toISOString(),
        metadata: {
          requestedAt: new Date().toISOString(),
          source: params.requestSource,
        },
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  } catch (err) {
    logEvent("error", "gdpr_deletion_request_create_failed", {
      requestId,
      workspaceId: params.workspaceId,
      leadId: params.leadId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Verarbeitet ausstehende Löschanträge
 */
export async function processDeletionRequests(): Promise<{
  processed: number;
  failed: number;
}> {
  if (!admin) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const requestId = makeRequestId();

  try {
    // Hole alle fälligen Löschanträge
    const { data: requests, error } = await admin
      .from("deletion_requests")
      .select("*")
      .eq("status", "pending")
      .lte("deletion_deadline", new Date().toISOString());

    if (error) throw error;
    if (!requests || requests.length === 0) {
      return { processed: 0, failed: 0 };
    }

    for (const request of requests) {
      try {
        await processDeletionRequest(request);
        processed++;
      } catch (err) {
        logEvent("error", "gdpr_deletion_request_process_failed", {
          requestId,
          deletionRequestId: request.id,
          workspaceId: request.workspace_id,
          leadId: request.lead_id,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;

        // Markiere als fehlgeschlagen
        await admin
          .from("deletion_requests")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
            metadata: {
              ...request.metadata,
              error: String(err),
              failedAt: new Date().toISOString(),
            },
          })
          .eq("id", request.id);
      }
    }
  } catch (err) {
    logEvent("error", "gdpr_deletion_requests_run_failed", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { processed, failed };
}

/**
 * Verarbeitet einen einzelnen Löschantrag
 */
async function processDeletionRequest(request: any): Promise<void> {
  if (!admin) throw new Error("Supabase admin client not configured");

  // Starte Processing
  await admin
    .from("deletion_requests")
    .update({
      status: "processing",
      processed_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  // Anonymisiere Lead-Daten (behalte Metriken für Analytics)
  const anonymizedData = {
    personal: {
      firstName: null,
      lastName: null,
      email: null,
      linkedin: null,
    },
    organization: {
      name: "Anonymized",
      website: null,
    },
    extraction: {
      iqScore: 0,
      websiteContext: null,
      personContext: null,
      uniqueAngles: [],
    },
    newsletter: {
      body: null,
      subject: null,
    },
    anonymized_at: new Date().toISOString(),
    original_lead_id: request.lead_id,
  };

  // Update Lead mit anonymisierten Daten
  const { error: updateError } = await admin
    .from("leads")
    .update(anonymizedData)
    .eq("id", request.lead_id);

  if (updateError) throw updateError;

  // Lösche zugehörige Email-Sends
  await admin.from("email_sends").delete().eq("lead_id", request.lead_id);

  // Lösche Sequence Enrollments
  await admin
    .from("sequence_enrollments")
    .delete()
    .eq("lead_id", request.lead_id);

  // Markiere Löschantrag als abgeschlossen
  await admin
    .from("deletion_requests")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      metadata: {
        ...request.metadata,
        completedAt: new Date().toISOString(),
      },
    })
    .eq("id", request.id);
}

/**
 * Exportiert alle Daten eines Workspaces (DSGVO Art. 20)
 */
export async function exportWorkspaceData(workspaceId: string): Promise<{
  leads: any[];
  emails: any[];
  sequences: any[];
  auditLogs: any[];
  exportDate: string;
}> {
  if (!admin) throw new Error("Supabase admin client not configured");

  try {
    // Export Leads
    const { data: leads } = await admin
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Export Email Sends
    const { data: emails } = await admin
      .from("email_sends")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Export Sequences
    const { data: sequences } = await admin
      .from("sequences")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Export Audit Logs
    const { data: auditLogs } = await admin
      .from("audit_log")
      .select("*")
      .eq("workspace_id", workspaceId);

    return {
      leads: leads || [],
      emails: emails || [],
      sequences: sequences || [],
      auditLogs: auditLogs || [],
      exportDate: new Date().toISOString(),
    };
  } catch (err) {
    logEvent("error", "gdpr_workspace_export_failed", {
      requestId: makeRequestId(),
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Löscht einen kompletten Workspace mit allen Daten
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  if (!admin) throw new Error("Supabase admin client not configured");
  const requestId = makeRequestId();

  try {
    // Lösche in Abhängigkeitsreihenfolge
    await admin.from("email_sends").delete().eq("workspace_id", workspaceId);
    await admin
      .from("sequence_enrollments")
      .delete()
      .eq("workspace_id", workspaceId);
    await admin.from("sequences").delete().eq("workspace_id", workspaceId);
    await admin.from("leads").delete().eq("workspace_id", workspaceId);
    await admin.from("audit_log").delete().eq("workspace_id", workspaceId);
    await admin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId);
    await admin.from("workspaces").delete().eq("id", workspaceId);
  } catch (err) {
    logEvent("error", "gdpr_workspace_delete_failed", {
      requestId,
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Prüft ob eine Email bereits einen Löschantrag hat
 */
export async function hasDeletionRequest(email: string): Promise<boolean> {
  if (!admin) return false;
  const requestId = makeRequestId();

  try {
    const { data, error } = await admin
      .from("deletion_requests")
      .select("id")
      .eq("user_email", email)
      .in("status", ["pending", "processing"])
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0) || false;
  } catch (err) {
    logEvent("error", "gdpr_deletion_request_check_failed", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
