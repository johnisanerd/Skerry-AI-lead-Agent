// Apify LinkedIn People Search
// Env: APIFY_API_KEY
// Actor: curious_coder~linkedin-people-search

export interface ApifyLead {
  firstName: string;
  lastName: string;
  title: string;
  email?: string;
  linkedinUrl: string;
  companyName: string;
  companyWebsite?: string;
}

export async function discoverLeadsApify(params: {
  searchQuery: string;
  maxResults: number;
  requestId: string;
}): Promise<ApifyLead[]> {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) throw new Error("APIFY_API_KEY_MISSING");

  const actorId =
    process.env.APIFY_LEADS_ACTOR_ID ?? "curious_coder~linkedin-people-search";
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`;

  // Start run
  const runResp = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchQuery: params.searchQuery,
      maxResults: params.maxResults,
      proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
    }),
  });
  if (!runResp.ok) throw new Error(`Apify run start failed: ${runResp.status}`);
  const runData = (await runResp.json()) as { data: { id: string } };
  const runId = runData.data.id;

  // Poll for completion (max 3 min)
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusResp = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
    );
    const statusData = (await statusResp.json()) as {
      data: { status: string; defaultDatasetId: string };
    };
    if (statusData.data.status === "SUCCEEDED") {
      const dataResp = await fetch(
        `https://api.apify.com/v2/datasets/${statusData.data.defaultDatasetId}/items?token=${apiKey}`
      );
      const items = (await dataResp.json()) as Record<string, unknown>[];
      return items.map(item => ({
        firstName: String(item["firstName"] ?? item["first_name"] ?? ""),
        lastName: String(item["lastName"] ?? item["last_name"] ?? ""),
        title: String(item["title"] ?? item["jobTitle"] ?? "Executive"),
        email: item["email"] ? String(item["email"]) : undefined,
        linkedinUrl: String(item["url"] ?? item["linkedinUrl"] ?? ""),
        companyName: String(item["companyName"] ?? item["company"] ?? ""),
        companyWebsite: item["companyWebsite"]
          ? String(item["companyWebsite"])
          : undefined,
      }));
    }
    if (statusData.data.status === "FAILED")
      throw new Error("Apify run FAILED");
  }
  throw new Error("apify_timeout");
}
