/**
 * Apollo.io People Search — primärer Lead-Discovery-Provider.
 * Docs: https://apolloio.github.io/apollo-api-docs
 * Env: APOLLO_API_KEY
 * Legal: vollständig ToS-konform, DSGVO-konform, offiziell lizenziert.
 */

import { fetchWithResilience } from "../lib/providerResilience.js";
import { logEvent } from "../lib/logger.js";

export interface ApolloLead {
  firstName: string;
  lastName: string;
  title: string;
  email: string | null;
  linkedinUrl: string | null;
  companyName: string;
  companyWebsite: string | null;
  city: string | null;
  country: string | null;
  seniority: string | null;
}

export interface ApolloSearchParams {
  personTitles: string[]; // z.B. ["VP of Growth", "Head of Marketing"]
  personLocations?: string[]; // z.B. ["Germany", "Austria", "Switzerland"]
  organizationNumEmployeesRanges?: string[]; // z.B. ["51,200", "201,500"]
  page?: number;
  perPage?: number;
  requestId: string;
}

export async function searchApollo(
  params: ApolloSearchParams
): Promise<ApolloLead[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY_MISSING");

  const body = {
    api_key: apiKey,
    page: params.page ?? 1,
    per_page: Math.min(params.perPage ?? 10, 25), // max 25 pro Request
    person_titles: params.personTitles,
    ...(params.personLocations && { person_locations: params.personLocations }),
    ...(params.organizationNumEmployeesRanges && {
      organization_num_employees_ranges: params.organizationNumEmployeesRanges,
    }),
  };

  try {
    const resp = await fetchWithResilience(
      "https://api.apollo.io/v1/mixed_people/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(body),
      },
      {
        provider: "apollo",
        requestId: params.requestId,
        maxRetries: 3,
        timeoutMs: 30000,
      }
    );

    if (resp.status === 401) throw new Error("APOLLO_API_KEY_INVALID");
    if (resp.status === 429) throw new Error("APOLLO_RATE_LIMIT");
    if (!resp.ok) throw new Error(`Apollo API error: ${resp.status}`);

    const data = (await resp.json()) as {
      people?: Array<{
        first_name?: string;
        last_name?: string;
        title?: string;
        email?: string;
        linkedin_url?: string;
        organization?: { name?: string; website_url?: string };
        city?: string;
        country?: string;
        seniority?: string;
      }>;
      pagination?: { total_entries: number };
    };

    return (data.people ?? []).map(p => ({
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      title: p.title ?? "Executive",
      email: p.email ?? null,
      linkedinUrl: p.linkedin_url ?? null,
      companyName: p.organization?.name ?? "",
      companyWebsite: p.organization?.website_url ?? null,
      city: p.city ?? null,
      country: p.country ?? null,
      seniority: p.seniority ?? null,
    }));
  } catch (err) {
    // Log the error with context
    logEvent("error", "apollo_discovery_failed", {
      requestId: params.requestId,
      error: String(err),
      page: params.page ?? 1,
    });

    // Re-throw with appropriate error code for degradation UX
    if ((err as any)?.code === "CIRCUIT_OPEN") {
      const circuitErr = new Error("Apollo service temporarily unavailable (circuit open)");
      (circuitErr as any).code = "PROVIDER_CIRCUIT_OPEN";
      (circuitErr as any).provider = "apollo";
      throw circuitErr;
    }

    throw err;
  }
}
