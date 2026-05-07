/**
 * Client-side wrapper for Skerry's server-side proxy endpoints.
 * Server runs on port 3001 in dev (set VITE_API_BASE=http://localhost:3001),
 * same-origin in production.
 */

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

function getWorkspaceHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem("skerry-workspace");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: { currentId?: unknown } };
    const id = parsed.state?.currentId;
    if (typeof id === "string" && id.trim()) {
      return { "x-workspace-id": id.trim() };
    }
    return {};
  } catch {
    return {};
  }
}

export type UserRole = "user" | "developer";
export type AccountTier = "solo" | "team" | "agency";

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
  tier: AccountTier;
}

interface VerifyResponse {
  ok: boolean;
  valid: boolean;
  status: string;
  warning?: string;
  code?: string;
  message?: string;
}

interface SendResponse {
  ok: boolean;
  id?: string;
  dryRun?: boolean;
  code?: string;
  message?: string;
}

interface HealthResponse {
  ok: boolean;
  version: string;
  services: {
    apollo: boolean;
    openai: boolean;
    resend: boolean;
    neverbounce: boolean;
    supabase: boolean;
    stripe: boolean;
  };
  circuits?: Record<string, {
    state: string;
    failureCount: number;
    successCount: number;
    isOpen: boolean;
  }>;
  discovery_provider: string;
  demo_mode: boolean;
  ready_for_production: boolean;
}

interface AuthResponse {
  ok: boolean;
  user?: AuthUser;
  csrfToken?: string;
  code?: string;
  message?: string;
}

export interface EntitlementUsageResponse {
  ok: boolean;
  tier?: AccountTier;
  usageMonth?: string;
  runsUsed?: number;
  monthlyRuns?: number;
  runsRemaining?: number;
  maxLeadsPerRun?: number;
  requestedLeads?: number;
  code?: string;
  message?: string;
}

export interface ServerGeneratedLead {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  linkedin: string;
  organization: { name: string; website: string };
  websiteContext: string;
  personContext: string;
  uniqueAngles: string[];
}

interface GenerateLeadsResponse {
  ok: boolean;
  source?: "openai" | "synthesizer";
  leads?: ServerGeneratedLead[];
  tier?: AccountTier;
  usageMonth?: string;
  runsUsed?: number;
  monthlyRuns?: number;
  runsRemaining?: number;
  maxLeadsPerRun?: number;
  code?: string;
  message?: string;
}

interface GenerateEmailResponse {
  ok: boolean;
  source?: "openai" | "synthesizer";
  markdown?: string;
  code?: string;
  message?: string;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiPostWithCsrf<T>(path, body);
}

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: getWorkspaceHeader(),
  });
  return resp.json() as Promise<T>;
}

let csrfTokenCache: string | null = null;

function isCsrfFailure(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const maybeMessage = (payload as { message?: unknown }).message;
  return (
    typeof maybeMessage === "string" && maybeMessage.toLowerCase().includes("csrf")
  );
}

async function refreshCsrfToken(): Promise<string | null> {
  const resp = await fetch(`${API_BASE}/api/auth/csrf`, {
    credentials: "include",
  });
  const json = (await resp.json()) as { ok?: boolean; csrfToken?: string };
  if (!resp.ok || !json.ok || !json.csrfToken) {
    csrfTokenCache = null;
    return null;
  }
  csrfTokenCache = json.csrfToken;
  return csrfTokenCache;
}

async function apiPostWithCsrf<T>(path: string, body: unknown): Promise<T> {
  if (!csrfTokenCache && path !== "/api/auth/login") {
    await refreshCsrfToken();
  }
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...getWorkspaceHeader(),
  };
  if (csrfTokenCache) {
    requestHeaders["X-CSRF-Token"] = csrfTokenCache;
  }

  let resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: requestHeaders,
    credentials: "include",
    body: JSON.stringify(body),
  });
  let json = (await resp.json()) as T;

  if (
    resp.status === 403 &&
    isCsrfFailure(json) &&
    path !== "/api/auth/login"
  ) {
    const fresh = await refreshCsrfToken();
    if (fresh) {
      resp = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { ...requestHeaders, "X-CSRF-Token": fresh },
        credentials: "include",
        body: JSON.stringify(body),
      });
      json = (await resp.json()) as T;
    }
  }

  const maybeCsrf = json as { csrfToken?: string };
  if (maybeCsrf.csrfToken) {
    csrfTokenCache = maybeCsrf.csrfToken;
  }
  return json;
}

async function apiPutWithCsrf<T>(path: string, body: unknown): Promise<T> {
  if (!csrfTokenCache && path !== "/api/auth/login") {
    await refreshCsrfToken();
  }
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...getWorkspaceHeader(),
  };
  if (csrfTokenCache) {
    requestHeaders["X-CSRF-Token"] = csrfTokenCache;
  }

  let resp = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: requestHeaders,
    credentials: "include",
    body: JSON.stringify(body),
  });
  let json = (await resp.json()) as T;

  if (
    resp.status === 403 &&
    isCsrfFailure(json) &&
    path !== "/api/auth/login"
  ) {
    const fresh = await refreshCsrfToken();
    if (fresh) {
      resp = await fetch(`${API_BASE}${path}`, {
        method: "PUT",
        headers: { ...requestHeaders, "X-CSRF-Token": fresh },
        credentials: "include",
        body: JSON.stringify(body),
      });
      json = (await resp.json()) as T;
    }
  }

  const maybeCsrf = json as { csrfToken?: string };
  if (maybeCsrf.csrfToken) {
    csrfTokenCache = maybeCsrf.csrfToken;
  }
  return json;
}

export async function verifyEmail(email: string): Promise<VerifyResponse> {
  try {
    return await apiPost<VerifyResponse>("/api/email/verify", { email });
  } catch (err) {
    return {
      ok: false,
      valid: false,
      status: "network_error",
      message: String(err),
    };
  }
}

export async function sendEmail(args: {
  to: string;
  subject?: string;
  bodyMarkdown: string;
}): Promise<SendResponse> {
  try {
    return await apiPost<SendResponse>("/api/email/send", args);
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function serverHealth(): Promise<HealthResponse | null> {
  try {
    return await apiGet<HealthResponse>("/api/health");
  } catch {
    return null;
  }
}

export async function authLogin(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const response = await apiPost<AuthResponse>("/api/auth/login", {
      email,
      password,
    });
    if (response.csrfToken) csrfTokenCache = response.csrfToken;
    return response;
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function authSession(): Promise<AuthResponse> {
  try {
    const response = await apiGet<AuthResponse>("/api/auth/session");
    if (response.csrfToken) csrfTokenCache = response.csrfToken;
    return response;
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function authLogout(): Promise<{ ok: boolean }> {
  try {
    const response = await apiPost<{ ok: boolean }>("/api/auth/logout", {});
    csrfTokenCache = null;
    return response;
  } catch {
    csrfTokenCache = null;
    return { ok: false };
  }
}

export async function getEntitlementUsage(): Promise<EntitlementUsageResponse> {
  try {
    return await apiGet<EntitlementUsageResponse>("/api/entitlements/usage");
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function authorizeResearchStart(
  requestedLeads: number
): Promise<EntitlementUsageResponse> {
  try {
    return await apiPost<EntitlementUsageResponse>(
      "/api/entitlements/research/start",
      {
        requestedLeads,
      }
    );
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function generateLeadsServer(args: {
  businessDescription?: string;
  targetAudience?: string;
  requestedLeads: number;
}): Promise<GenerateLeadsResponse> {
  try {
    return await apiPost<GenerateLeadsResponse>("/api/leads/generate", args);
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function generateEmailServer(args: {
  lead: {
    firstName: string;
    lastName: string;
    title: string;
    organization: { name: string };
    websiteContext: string;
    personContext: string;
    uniqueAngles: string[];
  };
  businessDescription?: string;
  senderName?: string;
  angle?: string;
}): Promise<GenerateEmailResponse> {
  try {
    return await apiPost<GenerateEmailResponse>("/api/email/generate", args);
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

// ──────────── Lead Enrichment & Persistence
export interface EnrichLeadResponse {
  ok: boolean;
  enriched?: Array<{
    id: string;
    enriched: Record<string, unknown>;
    intentScore: number;
  }>;
  tier?: AccountTier;
  usageMonth?: string;
  apiCallsUsed?: number;
  monthlyApiCalls?: number;
  apiCallsRemaining?: number;
  code?: string;
  message?: string;
}

export async function enrichLeads(leadIds: string[]): Promise<EnrichLeadResponse> {
  try {
    return await apiPost<EnrichLeadResponse>("/api/leads/enrich", { leadIds });
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

interface PersistLeadsResponse {
  ok: boolean;
  persisted?: boolean;
  count?: number;
  code?: string;
  message?: string;
}

export async function persistLeads(leads: ServerGeneratedLead[]): Promise<PersistLeadsResponse> {
  try {
    return await apiPost<PersistLeadsResponse>("/api/leads/persist", { leads });
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

// ──────────── Lead Export
export interface ExportLeadsResponse {
  ok: boolean;
  content?: string;
  code?: string;
  message?: string;
}

export async function exportLeads(format: "csv" | "hubspot" | "salesforce" = "csv"): Promise<Blob | null> {
  try {
    const headers = getWorkspaceHeader();
    const resp = await fetch(`${API_BASE}/api/leads/export?format=${format}`, {
      credentials: "include",
      headers,
    });
    if (!resp.ok) return null;
    return await resp.blob();
  } catch (err) {
    console.error("Export failed:", err);
    return null;
  }
}

// ──────────── GDPR
interface GDPRDeletionResponse {
  ok: boolean;
  requestId?: string;
  code?: string;
  message?: string;
}

export async function requestDataDeletion(leadId: string): Promise<GDPRDeletionResponse> {
  try {
    return await apiPost<GDPRDeletionResponse>("/api/gdpr/deletion-request", {
      leadId,
      requestSource: "user_request",
    });
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function requestDataExport(): Promise<Blob | null> {
  try {
    const headers = getWorkspaceHeader();
    const resp = await fetch(`${API_BASE}/api/gdpr/data-export`, {
      credentials: "include",
      headers,
    });
    if (!resp.ok) return null;
    return await resp.blob();
  } catch (err) {
    console.error("Data export failed:", err);
    return null;
  }
}

// ──────────── White-Label Brand Settings
export interface BrandSettings {
  brand_name?: string;
  brand_logo_url?: string;
  brand_primary_color?: string;
  custom_domain?: string;
  from_email?: string;
}

interface BrandResponse {
  ok: boolean;
  brand?: BrandSettings;
  code?: string;
  message?: string;
}

export async function getBrandSettings(workspaceId: string): Promise<BrandResponse> {
  try {
    return await apiGet<BrandResponse>(`/api/workspaces/${workspaceId}/brand`);
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

export async function updateBrandSettings(workspaceId: string, settings: BrandSettings): Promise<BrandResponse> {
  try {
    return await apiPutWithCsrf<BrandResponse>(`/api/workspaces/${workspaceId}/brand`, {
      brandName: settings.brand_name,
      brandLogoUrl: settings.brand_logo_url,
      brandPrimaryColor: settings.brand_primary_color,
      customDomain: settings.custom_domain,
      fromEmail: settings.from_email,
    });
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}
