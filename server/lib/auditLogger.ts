/**
 * Audit Logger - protokolliert alle wichtigen Aktionen für Compliance.
 * Dependencies: Supabase
 * Env: SUPABASE_URL
 */

import { admin } from "../supabaseAdmin.js";
import { logEvent, makeRequestId } from "./logger.js";

export interface AuditLogParams {
  workspaceId: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Schreibt einen Audit Log Eintrag
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  if (!admin) {
    logEvent("warn", "audit_log_skipped_no_admin", {
      requestId: makeRequestId(),
      workspaceId: params.workspaceId,
      action: params.action,
    });
    return;
  }

  try {
    const { error } = await admin.from("audit_log").insert({
      workspace_id: params.workspaceId,
      user_id: params.userId || null,
      action: params.action,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      logEvent("error", "audit_log_write_failed", {
        requestId: makeRequestId(),
        workspaceId: params.workspaceId,
        action: params.action,
        error: String(error),
      });
    }
  } catch (err) {
    logEvent("error", "audit_log_write_failed", {
      requestId: makeRequestId(),
      workspaceId: params.workspaceId,
      action: params.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Convenience Functions für häufige Aktionen
 */

export async function logLeadDiscovered(params: {
  workspaceId: string;
  userId?: string;
  count: number;
  provider: "apollo" | "openai";
  requestId: string;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "lead.discovered",
    resourceType: "lead",
    metadata: {
      count: params.count,
      provider: params.provider,
      requestId: params.requestId,
    },
  });
}

export async function logEmailSent(params: {
  workspaceId: string;
  userId?: string;
  leadId: string;
  subject: string;
  messageId: string;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "email.sent",
    resourceType: "email",
    resourceId: params.leadId,
    metadata: {
      leadId: params.leadId,
      subject: params.subject,
      messageId: params.messageId,
    },
  });
}

export async function logEmailFailed(params: {
  workspaceId: string;
  userId?: string;
  leadId: string;
  error: string;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "email.failed",
    resourceType: "email",
    resourceId: params.leadId,
    metadata: {
      leadId: params.leadId,
      error: params.error,
    },
  });
}

export async function logLeadDeleted(params: {
  workspaceId: string;
  userId?: string;
  leadId: string;
  leadName: string;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "lead.deleted",
    resourceType: "lead",
    resourceId: params.leadId,
    metadata: {
      leadId: params.leadId,
      leadName: params.leadName,
    },
  });
}

export async function logPlanUpgraded(params: {
  workspaceId: string;
  userId?: string;
  fromPlan: string;
  toPlan: string;
  stripeSubscriptionId?: string;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "plan.upgraded",
    resourceType: "workspace",
    resourceId: params.workspaceId,
    metadata: {
      fromPlan: params.fromPlan,
      toPlan: params.toPlan,
      stripeSubscriptionId: params.stripeSubscriptionId,
    },
  });
}

export async function logWorkspaceSettingsChanged(params: {
  workspaceId: string;
  userId?: string;
  changes: Record<string, { from: any; to: any }>;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "workspace.settings_changed",
    resourceType: "workspace",
    resourceId: params.workspaceId,
    metadata: {
      changes: params.changes,
    },
  });
}

export async function logSequenceCreated(params: {
  workspaceId: string;
  userId?: string;
  sequenceId: string;
  sequenceName: string;
  stepsCount: number;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "sequence.created",
    resourceType: "sequence",
    resourceId: params.sequenceId,
    metadata: {
      sequenceId: params.sequenceId,
      sequenceName: params.sequenceName,
      stepsCount: params.stepsCount,
    },
  });
}

export async function logLeadEnrolled(params: {
  workspaceId: string;
  userId?: string;
  leadId: string;
  sequenceId: string;
  sequenceName: string;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "lead.enrolled",
    resourceType: "sequence_enrollment",
    resourceId: params.leadId,
    metadata: {
      leadId: params.leadId,
      sequenceId: params.sequenceId,
      sequenceName: params.sequenceName,
    },
  });
}

export async function logExportPerformed(params: {
  workspaceId: string;
  userId?: string;
  format: string;
  leadCount: number;
}): Promise<void> {
  return logAudit({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: "leads.exported",
    resourceType: "export",
    metadata: {
      format: params.format,
      leadCount: params.leadCount,
    },
  });
}

/**
 * Holt Audit Logs für einen Workspace
 */
export async function getAuditLogs(
  workspaceId: string,
  limit: number = 100,
  actionType?: string
): Promise<any[]> {
  if (!admin) return [];

  try {
    let query = admin
      .from("audit_log")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (actionType) {
      query = query.eq("action", actionType);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (err) {
    logEvent("error", "audit_logs_fetch_failed", {
      requestId: makeRequestId(),
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
