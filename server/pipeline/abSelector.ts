/**
 * A/B Testing Engine - wählt Email-Varianten und berechnet Performance.
 * Dependencies: Supabase
 * Env: SUPABASE_URL
 */

import { admin } from '../supabaseAdmin.js';

export interface EmailVariant {
  id: string;
  weight: number;           // 0-100, Summe aller Varianten = 100
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface ABTestResult {
  variantId: string;
  sends: number;
  opens: number;
  clicks: number;
  replies: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  intentScore: number;
}

export interface ABTest {
  id: string;
  workspaceId: string;
  sequenceId: string;
  stepNumber: number;
  variants: EmailVariant[];
  status: 'active' | 'completed';
  winnerVariantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wählt eine Variante basierend auf Gewichtung (weighted random)
 */
export function selectVariant(variants: EmailVariant[]): EmailVariant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant;
    }
  }
  
  // Fallback (sollte nie passieren)
  return variants[0];
}

/**
 * Speichert welche Variante für einen Lead-Send genutzt wurde
 */
export async function recordVariantSelection(
  emailSendId: string,
  variantId: string,
  abTestId: string
): Promise<void> {
  if (!admin) return;

  try {
    await admin
      .from('email_sends')
      .update({
        ab_test_id: abTestId,
        variant_id: variantId
      })
      .eq('id', emailSendId);
  } catch (err) {
    console.error('Failed to record variant selection:', err);
  }
}

/**
 * Berechnet A/B Test Performance für alle Varianten
 */
export async function calculateABTestPerformance(abTestId: string): Promise<ABTestResult[]> {
  if (!admin) return [];

  try {
    // Hole alle Email-Sends für diesen A/B Test
    const { data: emailSends, error } = await admin
      .from('email_sends')
      .select('variant_id, events, created_at')
      .eq('ab_test_id', abTestId);

    if (error || !emailSends) {
      console.error('Failed to fetch A/B test data:', error);
      return [];
    }

    // Gruppiere nach Variant
    const variantGroups: Record<string, any[]> = {};
    for (const send of emailSends) {
      const variantId = send.variant_id;
      if (!variantId) continue;
      
      if (!variantGroups[variantId]) {
        variantGroups[variantId] = [];
      }
      variantGroups[variantId].push(send);
    }

    // Berechne Performance pro Variante
    const results: ABTestResult[] = [];
    for (const [variantId, sends] of Object.entries(variantGroups)) {
      const result = await calculateVariantPerformance(variantId, sends);
      results.push(result);
    }

    return results.sort((a, b) => b.intentScore - a.intentScore);

  } catch (err) {
    console.error('Failed to calculate A/B test performance:', err);
    return [];
  }
}

/**
 * Berechnet Performance für eine einzelne Variante
 */
async function calculateVariantPerformance(
  variantId: string,
  emailSends: any[]
): Promise<ABTestResult> {
  let opens = 0;
  let clicks = 0;
  let replies = 0;

  for (const send of emailSends) {
    const events = (send.events as any[]) || [];
    
    if (events.some(e => e.type === 'opened')) opens++;
    if (events.some(e => e.type === 'clicked')) clicks++;
    if (events.some(e => e.type === 'replied')) replies++;
  }

  const sends = emailSends.length;
  const openRate = sends > 0 ? (opens / sends) * 100 : 0;
  const clickRate = sends > 0 ? (clicks / sends) * 100 : 0;
  const replyRate = sends > 0 ? (replies / sends) * 100 : 0;

  // Intent Score basierend auf Gewichtung
  const intentScore = (openRate * 0.3) + (clickRate * 0.3) + (replyRate * 0.4);

  return {
    variantId,
    sends,
    opens,
    clicks,
    replies,
    openRate,
    clickRate,
    replyRate,
    intentScore
  };
}

/**
 * Prüft ob ein A/B Test genügend Sends für aussagekräftige Ergebnisse hat
 */
export function hasEnoughDataForConclusion(results: ABTestResult[]): boolean {
  const totalSends = results.reduce((sum, r) => sum + r.sends, 0);
  return totalSends >= 50; // Mindestens 50 Sends gesamt
}

/**
 * Wählt die Gewinner-Variante basierend auf Intent Score
 */
export function selectWinner(results: ABTestResult[]): string | null {
  if (results.length === 0) return null;
  
  const winner = results.reduce((best, current) => 
    current.intentScore > best.intentScore ? current : best
  );

  // Nur wenn signifikanter Unterschied (>5 Punkte)
  const secondBest = results
    .filter(r => r.variantId !== winner.variantId)
    .sort((a, b) => b.intentScore - a.intentScore)[0];

  if (secondBest && (winner.intentScore - secondBest.intentScore) < 5) {
    return null; // Kein klarer Gewinner
  }

  return winner.variantId;
}

/**
 * Promotet eine Variante zu 100% Gewichtung
 */
export async function promoteWinner(abTestId: string, winnerVariantId: string): Promise<void> {
  if (!admin) return;

  try {
    // Hole den A/B Test
    const { data: abTest, error } = await admin
      .from('ab_tests')
      .select('*')
      .eq('id', abTestId)
      .single();

    if (error || !abTest) {
      console.error('Failed to fetch A/B test for promotion:', error);
      return;
    }

    const variants = abTest.variants as EmailVariant[];
    const updatedVariants = variants.map(v => ({
      ...v,
      weight: v.id === winnerVariantId ? 100 : 0
    }));

    // Update A/B Test
    await admin
      .from('ab_tests')
      .update({
        variants: updatedVariants,
        winner_variant_id: winnerVariantId,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', abTestId);

    console.log(`A/B Test ${abTestId} completed. Winner: ${winnerVariantId}`);

  } catch (err) {
    console.error('Failed to promote A/B test winner:', err);
  }
}

/**
 * Erstellt einen neuen A/B Test
 */
export async function createABTest(
  workspaceId: string,
  sequenceId: string,
  stepNumber: number,
  variants: EmailVariant[]
): Promise<string | null> {
  if (!admin) return null;

  try {
    // Validiere Gewichtung
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error('Variant weights must sum to 100');
    }

    const { data, error } = await admin
      .from('ab_tests')
      .insert({
        workspace_id: workspaceId,
        sequence_id: sequenceId,
        step_number: stepNumber,
        variants,
        status: 'active'
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;

  } catch (err) {
    console.error('Failed to create A/B test:', err);
    return null;
  }
}
