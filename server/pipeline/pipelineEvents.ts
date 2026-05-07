/**
 * Pipeline Events Integration
 * Connects the scraping pipeline to the PipelineEmitter
 * This file patches the existing pipeline functions to emit events
 */

import { serverPipelineEmitter } from "../lib/pipelineEmitter";
import type { ServerLogType } from "../lib/pipelineEmitter";

/**
 * Wrap a pipeline step with event emission
 */
export function emitPipelineStep(
  type: ServerLogType,
  message: string,
  workspaceId?: string,
  data?: unknown
) {
  return serverPipelineEmitter.emitEvent(type, message, workspaceId, data);
}

/**
 * Emit discovery events
 */
export function emitDiscoveryEvent(
  message: string,
  workspaceId?: string,
  leadCount?: number
) {
  return serverPipelineEmitter.research(
    message,
    workspaceId,
    leadCount ? { leadCount } : undefined
  );
}

/**
 * Emit enrichment events
 */
export function emitEnrichmentEvent(
  message: string,
  workspaceId?: string,
  leadId?: string
) {
  return serverPipelineEmitter.enrich(
    message,
    workspaceId,
    leadId ? { leadId } : undefined
  );
}

/**
 * Emit intent scoring events
 */
export function emitIntentScoringEvent(
  message: string,
  workspaceId?: string,
  score?: number
) {
  return serverPipelineEmitter.analytics(
    message,
    workspaceId,
    score ? { score } : undefined
  );
}

/**
 * Emit draft generation events
 */
export function emitDraftEvent(
  message: string,
  workspaceId?: string,
  leadId?: string
) {
  return serverPipelineEmitter.draft(
    message,
    workspaceId,
    leadId ? { leadId } : undefined
  );
}

/**
 * Emit system events (proxy rotation, errors, etc.)
 */
export function emitSystemEvent(
  message: string,
  workspaceId?: string,
  error?: unknown
) {
  return serverPipelineEmitter.system(
    message,
    workspaceId,
    error ? { error: String(error) } : undefined
  );
}

/**
 * Get recent pipeline events for a workspace (for polling/SSE)
 */
export function getPipelineEvents(
  workspaceId: string,
  limit: number = 50
): Array<{
  id: string;
  timestamp: number;
  type: ServerLogType;
  message: string;
}> {
  return serverPipelineEmitter.getEvents(workspaceId, limit);
}

/**
 * Clear pipeline events for a workspace
 */
export function clearPipelineEvents(workspaceId: string): void {
  serverPipelineEmitter.clearEvents(workspaceId);
}
