/**
 * GDPR Processor - Background Job für automatische Löschfristen-Verarbeitung.
 * Läuft täglich und prüft fällige Löschanträge.
 * Dependencies: Supabase
 * Env: SUPABASE_URL
 */

import { processDeletionRequests } from "../pipeline/gdprService.js";
import { logEvent, makeRequestId } from "../lib/logger.js";

/**
 * Startet den GDPR Processor als täglichen Background Job
 */
export function startGdprProcessor(): void {
  // Alle 24 Stunden ausführen (86400000 ms)
  const interval = 24 * 60 * 60 * 1000;

  logEvent("info", "gdpr_processor_started", {
    requestId: makeRequestId(),
    interval,
  });

  setInterval(async () => {
    try {
      const requestId = makeRequestId();
      logEvent("info", "gdpr_processor_cycle_started", { requestId });

      const result = await processDeletionRequests();

      if (result.processed > 0 || result.failed > 0) {
        logEvent("info", "gdpr_processor_cycle_completed", {
          requestId,
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

  // Sofort beim Start ausführen (für verpasste Verarbeitung)
  setTimeout(async () => {
    try {
      const requestId = makeRequestId();
      logEvent("info", "gdpr_processor_initial_started", { requestId });
      const result = await processDeletionRequests();
      if (result.processed > 0 || result.failed > 0) {
        logEvent("info", "gdpr_processor_initial_completed", {
          requestId,
          ...result,
        });
      }
    } catch (err) {
      logEvent("error", "gdpr_processor_initial_failed", {
        requestId: makeRequestId(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, 5000); // 5 Sekunden nach Server-Start
}
