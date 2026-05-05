/**
 * Intent Scoring Engine - berechnet Engagement-Scores für Leads.
 * Dependencies: None
 * Env: None
 */

export interface EmailEvent {
  type: "delivered" | "opened" | "clicked" | "replied" | "bounced";
  createdAt: string;
  data?: Record<string, unknown>;
}

/**
 * Berechnet Intent-Score basierend auf Email-Events
 */
export function calculateIntentScore(events: EmailEvent[]): number {
  let score = 0;
  const weights = {
    delivered: 5,
    opened: 20,
    clicked: 40,
    replied: 80,
    bounced: -50,
  };

  // Sortiere Events nach Zeit (älteste zuerst)
  const sortedEvents = events.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const event of sortedEvents) {
    const weight = weights[event.type] ?? 0;
    score += weight;

    // Cap bei 100
    if (score > 100) score = 100;
    // Min bei 0 (außer bounced)
    if (score < 0 && event.type !== "bounced") score = 0;
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Bestimmt Intent-Level basierend auf Score
 */
export function getIntentLevel(score: number): "low" | "medium" | "high" {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * Berechnet Engagement-Rate
 */
export function calculateEngagementRate(events: EmailEvent[]): {
  openRate: number;
  clickRate: number;
  replyRate: number;
  totalEvents: number;
} {
  const totalEvents = events.length;
  if (totalEvents === 0) {
    return { openRate: 0, clickRate: 0, replyRate: 0, totalEvents: 0 };
  }

  const deliveredEvents = events.filter(e => e.type === "delivered").length;
  const openedEvents = events.filter(e => e.type === "opened").length;
  const clickedEvents = events.filter(e => e.type === "clicked").length;
  const repliedEvents = events.filter(e => e.type === "replied").length;

  return {
    openRate: deliveredEvents > 0 ? (openedEvents / deliveredEvents) * 100 : 0,
    clickRate:
      deliveredEvents > 0 ? (clickedEvents / deliveredEvents) * 100 : 0,
    replyRate:
      deliveredEvents > 0 ? (repliedEvents / deliveredEvents) * 100 : 0,
    totalEvents,
  };
}

/**
 * Prüft ob Lead aktiv ist (hat in den letzten 7 Tagen ein Event)
 */
export function isLeadActive(events: EmailEvent[]): boolean {
  if (events.length === 0) return false;

  const latestEvent = events.reduce((latest, current) =>
    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return new Date(latestEvent.createdAt) > sevenDaysAgo;
}

/**
 * Berechnet Response-Time (Zeit bis zur ersten Antwort)
 */
export function calculateResponseTime(events: EmailEvent[]): number | null {
  const deliveredEvent = events.find(e => e.type === "delivered");
  const replyEvent = events.find(e => e.type === "replied");

  if (!deliveredEvent || !replyEvent) return null;

  const deliveredTime = new Date(deliveredEvent.createdAt).getTime();
  const replyTime = new Date(replyEvent.createdAt).getTime();

  return Math.round((replyTime - deliveredTime) / (1000 * 60 * 60)); // Stunden
}
