/**
 * GDPR Processor - Background Job für automatische Löschfristen-Verarbeitung.
 * Läuft täglich und prüft fällige Löschanträge.
 * Dependencies: Supabase
 * Env: SUPABASE_URL
 */

import { processDeletionRequests } from '../pipeline/gdprService.js';

/**
 * Startet den GDPR Processor als täglichen Background Job
 */
export function startGdprProcessor(): void {
  // Alle 24 Stunden ausführen (86400000 ms)
  const interval = 24 * 60 * 60 * 1000;
  
  console.log('🔒 GDPR Processor started - runs every 24 hours');
  
  setInterval(async () => {
    try {
      console.log('🔒 Processing GDPR deletion requests...');
      
      const result = await processDeletionRequests();
      
      if (result.processed > 0 || result.failed > 0) {
        console.log(`🔒 GDPR Processing completed: ${result.processed} processed, ${result.failed} failed`);
      }
    } catch (err) {
      console.error('🔒 GDPR Processor cycle failed:', err);
    }
  }, interval);

  // Sofort beim Start ausführen (für verpasste Verarbeitung)
  setTimeout(async () => {
    try {
      console.log('🔒 Running initial GDPR processing...');
      const result = await processDeletionRequests();
      if (result.processed > 0 || result.failed > 0) {
        console.log(`🔒 Initial GDPR processing: ${result.processed} processed, ${result.failed} failed`);
      }
    } catch (err) {
      console.error('🔒 Initial GDPR processing failed:', err);
    }
  }, 5000); // 5 Sekunden nach Server-Start
}
