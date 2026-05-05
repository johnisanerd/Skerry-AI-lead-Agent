/**
 * Resend Webhook Handler - verarbeitet Email Events für Reply Detection.
 * Dependencies: Supabase
 * Env: SUPABASE_URL, RESEND_API_KEY
 */

import { admin } from '../../supabaseAdmin.js';
import { calculateIntentScore } from '../../pipeline/intentScorer.js';

interface ResendWebhookEvent {
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'replied';
  created_at: string;
  data: {
    from: string;
    to: string;
    subject: string;
    html?: string;
    text?: string;
    url?: string;
    ip?: string;
    user_agent?: string;
    email_id: string;
  };
}

/**
 * Verarbeitet Resend Webhook Events
 */
export async function handleResendWebhook(events: ResendWebhookEvent[]): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  if (!admin) {
    console.error('Supabase admin client not configured for webhook processing');
    return { processed: 0, errors: events.length };
  }

  for (const event of events) {
    try {
      // Finde den entsprechenden Email-Send Record
      const { data: emailSend, error: emailSendError } = await admin
        .from('email_sends')
        .select('id, lead_id, workspace_id, events')
        .eq('provider_message_id', event.data.email_id)
        .single();

      if (emailSendError || !emailSend) {
        console.warn(`Email send not found for message_id: ${event.data.email_id}`);
        errors++;
        continue;
      }

      // Event zu bestehenden Events hinzufügen
      const existingEvents = (emailSend.events as any[]) || [];
      const newEvent = {
        type: event.type,
        createdAt: event.created_at,
        data: {
          ip: event.data.ip,
          userAgent: event.data.user_agent,
          url: event.data.url,
        }
      };

      const updatedEvents = [...existingEvents, newEvent];

      // Update Email-Send Record
      const { error: updateError } = await admin
        .from('email_sends')
        .update({
          events: updatedEvents,
          status: mapEventToStatus(event.type),
          updated_at: new Date().toISOString()
        })
        .eq('id', emailSend.id);

      if (updateError) {
        console.error('Failed to update email send:', updateError);
        errors++;
        continue;
      }

      // Update Lead Intent Score
      await updateLeadIntentScore(emailSend.lead_id, event.type);

      // Wenn Reply detected -> Sequence Enrollment pausieren
      if (event.type === 'replied') {
        await pauseSequenceEnrollments(emailSend.lead_id);
      }

      processed++;

    } catch (err) {
      console.error('Error processing webhook event:', err);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Mappt Resend Event Typ zu Email-Send Status
 */
function mapEventToStatus(eventType: string): string {
  switch (eventType) {
    case 'delivered': return 'delivered';
    case 'opened': return 'opened';
    case 'clicked': return 'clicked';
    case 'bounced': return 'bounced';
    case 'complained': return 'bounced';
    case 'unsubscribed': return 'bounced';
    default: return 'pending';
  }
}

/**
 * Updated den Intent Score eines Leads basierend auf Events
 */
async function updateLeadIntentScore(leadId: string, eventType: string): Promise<void> {
  if (!admin) return;

  try {
    // Hole alle Events für diesen Lead
    const { data: emailSends } = await admin
      .from('email_sends')
      .select('events, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (!emailSends || emailSends.length === 0) return;

    // Sammle alle Events
    const allEvents: any[] = [];
    for (const send of emailSends) {
      const events = (send.events as any[]) || [];
      allEvents.push(...events);
    }

    // Berechne Intent Score
    const score = calculateIntentScore(allEvents);

    // Update Lead
    const latestEvent = allEvents[allEvents.length - 1];
    await admin
      .from('leads')
      .update({
        intent_score: score,
        last_event: latestEvent?.type || null,
        last_event_at: latestEvent?.createdAt ? new Date(latestEvent.createdAt).toISOString() : null
      })
      .eq('id', leadId);

  } catch (err) {
    console.error('Failed to update lead intent score:', err);
  }
}

/**
 * Pausiert alle aktiven Sequence Enrollments für einen Lead bei Reply
 */
async function pauseSequenceEnrollments(leadId: string): Promise<void> {
  if (!admin) return;

  try {
    const { error } = await admin
      .from('sequence_enrollments')
      .update({
        status: 'replied',
        updated_at: new Date().toISOString()
      })
      .eq('lead_id', leadId)
      .eq('status', 'active');

    if (error) {
      console.error('Failed to pause sequence enrollments:', error);
    }
  } catch (err) {
    console.error('Failed to pause sequence enrollments:', err);
  }
}

/**
 * Validiert Resend Webhook Signature
 */
export function validateResendWebhook(payload: string, signature: string, secret: string): boolean {
  try {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    console.error('Webhook signature validation failed:', err);
    return false;
  }
}
