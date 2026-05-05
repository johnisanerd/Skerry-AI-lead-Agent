/**
 * Discovery Router — wählt automatisch den besten verfügbaren Provider.
 * Priority: Apollo (legal, kostenlos) → OpenAI (Fallback) → Fehler
 * Env: APOLLO_API_KEY, OPENAI_API_KEY
 */

import { searchApollo } from "./apolloDiscover.js";

export interface DiscoveryParams {
  icp: {
    roles: string[]; // z.B. ["VP of Growth", "Head of Marketing"]
    locations?: string[]; // z.B. ["Germany", "DACH"]
    companySizeRange?: string; // z.B. "51,500"
  };
  limit: number;
  requestId: string;
}

export interface DiscoveryResult {
  leads: GeneratedLead[];
  source: "apollo" | "openai";
  provider_note?: string;
}

export interface GeneratedLead {
  firstName: string;
  lastName: string;
  title: string;
  email: string | null;
  linkedin: string | null;
  organization: { name: string; website: string | null };
  location: string | null;
  source: "apollo" | "openai";
}

export async function discoverLeads(
  params: DiscoveryParams
): Promise<DiscoveryResult> {
  // Provider 1: Apollo (bevorzugt — legal, strukturiert, kostenlos)
  if (process.env.APOLLO_API_KEY) {
    const raw = await searchApollo({
      personTitles: params.icp.roles,
      personLocations: params.icp.locations,
      organizationNumEmployeesRanges: params.icp.companySizeRange
        ? [params.icp.companySizeRange]
        : undefined,
      perPage: Math.min(params.limit, 25),
      requestId: params.requestId,
    });
    return {
      leads: raw.map(l => ({
        firstName: l.firstName,
        lastName: l.lastName,
        title: l.title,
        email: l.email,
        linkedin: l.linkedinUrl,
        organization: { name: l.companyName, website: l.companyWebsite },
        location: [l.city, l.country].filter(Boolean).join(", ") || null,
        source: "apollo",
      })),
      source: "apollo",
    };
  }

  // Provider 2: OpenAI (Fallback wenn kein Apollo-Key)
  if (process.env.OPENAI_API_KEY) {
    // Ruft die bereits existierende generateLeadsWithOpenAI()-Funktion auf
    // Gibt source: 'openai' zurück
    throw new Error("OPENAI_FALLBACK"); // Signal an server/index.ts die OpenAI-Route zu nehmen
  }

  // Kein Provider konfiguriert
  throw new Error("NO_DISCOVERY_PROVIDER");
}
