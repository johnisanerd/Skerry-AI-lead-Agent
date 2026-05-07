/**
 * Lead Enrichment Service - bereichert Leads mit zusätzlichen Daten.
 * Dependencies: OpenAI, Apify (optional)
 * Env: OPENAI_API_KEY, APIFY_API_KEY
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { withResilience } from "../lib/providerResilience.js";
import { logEvent } from "../lib/logger.js";

export interface EnrichedLead {
  companySize?: string;
  industry?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  website?: string;
  revenueRange?: string;
  fundingStage?: string;
}

export interface Lead {
  id: string;
  personal: {
    firstName?: string;
    lastName?: string;
    title?: string;
    email?: string;
  };
  organization: {
    name?: string;
    domain?: string;
  };
  extraction?: Record<string, unknown>;
}

/**
 * Bereichert einen Lead mit zusätzlichen Daten
 */
export async function enrichLead(lead: Lead, requestId?: string): Promise<EnrichedLead> {
  const enriched: EnrichedLead = {};

  // Basis-Daten aus Lead extrahieren
  const companyName = lead.organization?.name;
  const domain = lead.organization?.domain;
  const title = lead.personal?.title;
  const name = `${lead.personal?.firstName || ""} ${lead.personal?.lastName || ""}`.trim();

  if (!companyName && !domain) {
    return enriched; // Nichts zu bereichern
  }

  // OpenAI für Enrichment verwenden
  if (process.env.OPENAI_API_KEY) {
    try {
      const prompt = `Enrich the following lead data with additional company and professional information. Provide realistic details based on typical B2B SaaS patterns.

Lead:
- Name: ${name}
- Title: ${title}
- Company: ${companyName}
- Domain: ${domain}

Provide:
- Company size (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)
- Industry (e.g., Software, Fintech, Healthcare)
- LinkedIn URL (realistic format)
- Twitter URL (if applicable)
- Website (if not provided)
- Revenue range (e.g., $1M-$10M, $10M-$50M)
- Funding stage (e.g., Seed, Series A, Bootstrapped)

Return as JSON object.`;

      const result = await withResilience(
        async () => {
          return generateObject({
            model: openai("gpt-4o-mini"),
            prompt,
            schema: z.object({
              companySize: z.string().optional(),
              industry: z.string().optional(),
              linkedinUrl: z.string().optional(),
              twitterUrl: z.string().optional(),
              website: z.string().optional(),
              revenueRange: z.string().optional(),
              fundingStage: z.string().optional(),
            }),
          });
        },
        {
          provider: "openai",
          requestId,
          maxRetries: 3,
          timeoutMs: 30000,
        }
      );

      enriched.companySize = result.object.companySize;
      enriched.industry = result.object.industry;
      enriched.linkedinUrl = result.object.linkedinUrl;
      enriched.twitterUrl = result.object.twitterUrl;
      enriched.website = result.object.website;
      enriched.revenueRange = result.object.revenueRange;
      enriched.fundingStage = result.object.fundingStage;
    } catch (err) {
      // Log the error with context
      logEvent("error", "openai_enrichment_failed", {
        requestId,
        leadId: lead.id,
        error: String(err),
      });

      // Check if circuit is open for degradation UX
      if ((err as any)?.code === "CIRCUIT_OPEN" || (err as any)?.code === "PROVIDER_CIRCUIT_OPEN") {
        // Return partial data with circuit open indicator
        (enriched as any)._degraded = true;
        (enriched as any)._reason = "OpenAI service temporarily unavailable";
      }
      // On other errors, return empty enrichment (graceful degradation)
    }
  }

  return enriched;
}
