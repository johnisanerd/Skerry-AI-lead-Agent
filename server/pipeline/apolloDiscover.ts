/**
 * Apollo.io People Search — primärer Lead-Discovery-Provider.
 * Docs: https://apolloio.github.io/apollo-api-docs
 * Env: APOLLO_API_KEY
 * Legal: vollständig ToS-konform, DSGVO-konform, offiziell lizenziert.
 */

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
  personTitles: string[];       // z.B. ["VP of Growth", "Head of Marketing"]
  personLocations?: string[];   // z.B. ["Germany", "Austria", "Switzerland"]
  organizationNumEmployeesRanges?: string[]; // z.B. ["51,200", "201,500"]
  page?: number;
  perPage?: number;
  requestId: string;
}

export async function searchApollo(params: ApolloSearchParams): Promise<ApolloLead[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error('APOLLO_API_KEY_MISSING');

  const body = {
    api_key: apiKey,
    page: params.page ?? 1,
    per_page: Math.min(params.perPage ?? 10, 25), // max 25 pro Request
    person_titles: params.personTitles,
    ...(params.personLocations && { person_locations: params.personLocations }),
    ...(params.organizationNumEmployeesRanges && {
      organization_num_employees_ranges: params.organizationNumEmployeesRanges
    }),
  };

  const resp = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 401) throw new Error('APOLLO_API_KEY_INVALID');
  if (resp.status === 429) throw new Error('APOLLO_RATE_LIMIT');
  if (!resp.ok) throw new Error(`Apollo API error: ${resp.status}`);

  const data = await resp.json() as {
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
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    title: p.title ?? 'Executive',
    email: p.email ?? null,
    linkedinUrl: p.linkedin_url ?? null,
    companyName: p.organization?.name ?? '',
    companyWebsite: p.organization?.website_url ?? null,
    city: p.city ?? null,
    country: p.country ?? null,
    seniority: p.seniority ?? null,
  }));
}
