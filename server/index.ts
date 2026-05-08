/**
 * Skerry — server-side proxy for sensitive API calls.
 *
 * Why: VITE_* env vars end up in the client bundle. For real production we
 * want OpenAI / Resend / NeverBounce keys server-only. The client calls
 * scoped endpoints here; this process holds the secrets.
 *
 * In dev, Vite handles the SPA on port 3000. This server runs alongside on
 * port 3001 and exposes JSON endpoints under /api/*. The client calls
 * `${import.meta.env.VITE_API_BASE ?? ""}/api/...`, defaulting to same-origin
 * (works in production), or `http://localhost:3001` in dev when set.
 *
 * Env vars (no VITE_ prefix — server-only):
 *   OPENAI_API_KEY
 *   RESEND_API_KEY
 *   NEVERBOUNCE_API_KEY
 *   APIFY_API_KEY
 *   SKERRY_FROM_EMAIL              e.g. "Skerry <hello@your-domain.com>"
 *   SKERRY_ALLOWED_ORIGINS         optional comma-separated list, e.g.
 *                                  "https://app.example.com,http://localhost:3000"
 *                                  When set, browser requests with Origin not in the
 *                                  list get 403 on /api/* (CSRF cookies + credentialed API).
 *   DATABASE_URL                   Postgres for entitlement usage (optional in dev).
 *   DATABASE_SSL_REJECT_UNAUTHORIZED  production default true; set "false" only if your
 *                                  provider uses a non-public CA (not recommended).
 */

import "dotenv/config";


// Initialize Sentry as early as possible
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.SENTRY_RELEASE || "unknown",
  tracesSampleRate: 1.0,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
  // PII scrubbing: emails, API keys, lead names must never appear in Sentry
  beforeSend(event) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const apiKeyRegex = /(api[_-]?key|apikey|authorization|bearer)\s*[:=]\s*[\w\-]{20,}/gi;

    const scrubEmails = (s: string): string => s.replace(emailRegex, "[email-redacted]");
    const scrubApiKeys = (s: string): string => s.replace(apiKeyRegex, "$1 [redacted]");

    const scrubLeadNames = (obj: unknown): unknown => {
      if (Array.isArray(obj)) return obj.map(scrubLeadNames);
      if (obj !== null && typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          if (/name|firstName|lastName|fullName/i.test(key) && typeof value === "string") {
            result[key] = "[name-redacted]";
          } else {
            result[key] = scrubLeadNames(value);
          }
        }
        return result;
      }
      if (typeof obj === "string") return scrubEmails(scrubApiKeys(obj));
      return obj;
    };

    if (event.message) event.message = scrubEmails(scrubApiKeys(event.message));
    if (event.exception?.values) {
      for (const exc of event.exception.values) {
        if (exc.value) exc.value = scrubEmails(scrubApiKeys(exc.value));
        if (exc.stacktrace?.frames) {
          for (const frame of exc.stacktrace.frames) {
            if (frame.vars) frame.vars = scrubLeadNames(frame.vars) as Record<string, unknown>;
          }
        }
      }
    }
    if (event.request) event.request = scrubLeadNames(event.request) as typeof event.request;
    if (event.extra) event.extra = scrubLeadNames(event.extra) as Record<string, unknown>;
    return event;
  },
});

import express from "express";
import { createServer } from "http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import { z } from "zod";
import { EntitlementDb } from "./db";
import { assertEnterpriseProductionConfig } from "./productionConfig";
import { admin } from "./supabaseAdmin";
// Use Upstash rate limiter with sliding window algorithm
// Falls back to in-memory if UPSTASH_REDIS_URL is not set
import { workspaceRateLimit, authRateLimit, isUpstashConfigured } from "./lib/upstashRateLimit.js";
import { discoverLeads } from "./pipeline/discoveryRouter";
import {
  handleResendWebhook,
  validateResendWebhook,
} from "./routes/webhooks/resendWebhook.js";
import {
  createABTest,
  calculateABTestPerformance,
  promoteWinner,
} from "./pipeline/abSelector.js";
import {
  generateCSVExport,
  generateHubSpotExport,
  generateSalesforceExport,
} from "./pipeline/exportService.js";
import { logAudit, getAuditLogs } from "./lib/auditLogger.js";
import {
  createDeletionRequest,
  exportWorkspaceData,
  deleteWorkspace,
  hasDeletionRequest,
} from "./pipeline/gdprService.js";
import { enrichLead } from "./pipeline/enrichmentService.js";
import { calculateIntentScore } from "./pipeline/intentScorer.js";
import { logEvent, makeRequestId } from "./lib/logger.js";
import { getProvidersHealth } from "./lib/providerResilience.js";
import { ErrorCode, createError } from "../shared/errors.js";
import {
  validate,
  loginSchema,
  entitlementStartSchema,
  generateLeadsSchema,
  generateEmailSchema,
  verifyEmailSchema,
  sendEmailSchema,
  enrichLeadsSchema,
  persistLeadsSchema,
  createSequenceSimpleSchema,
  enrollSequenceSchema,
  billingCheckoutSchema,
  gdprDeletionRequestSchema,
  resendWebhookSchema,
  updateICPSchema,
  updateBrandSchema,
  deleteWorkspaceSchema,
  createABTestSchema,
  promoteABTestSchema,
  seedLeadsSchema,
  commonSchemas,
  healthQuerySchema,
  billingWebhookSchema,
  sequencesQuerySchema,
  abTestResultsQuerySchema,
  exportLeadsQuerySchema,
  auditLogsQuerySchema,
  workspacesQuerySchema,
} from "./middleware/validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SendEmailBody {
  to: string;
  subject?: string;
  bodyMarkdown: string;
}

interface VerifyEmailBody {
  email: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface EntitlementStartBody {
  requestedLeads?: number;
}

interface GenerateLeadsBody {
  businessDescription?: string;
  targetAudience?: string;
  requestedLeads?: number;
}

interface GenerateEmailBody {
  lead?: {
    firstName?: string;
    lastName?: string;
    title?: string;
    organization?: { name?: string };
    websiteContext?: string;
    personContext?: string;
    uniqueAngles?: string[];
  };
  businessDescription?: string;
  senderName?: string;
  angle?: string;
}

type AccountTier = "solo" | "team" | "agency";
type UserRole = "user" | "developer";
type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tier: AccountTier;
}

interface SessionPayload {
  user: AuthSessionUser;
  exp: number;
}

interface RequestContext {
  requestId: string;
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
}

interface RequestWithContext extends express.Request {
  ctx?: RequestContext;
}

interface GeneratedLead {
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

const AUTH_COOKIE_NAME = "skerry_session";
const CSRF_COOKIE_NAME = "skerry_csrf";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_SECRET = process.env.SESSION_SECRET;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const ALLOW_DEMO_AUTH = process.env.ALLOW_DEMO_AUTH === "true";

function parseAllowedOrigins(): string[] {
  return (process.env.SKERRY_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(
  origin: string | undefined,
  allowed: string[]
): boolean {
  if (!origin) return true;
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}

const DEMO_USERS: Record<string, { password: string; user: AuthSessionUser }> =
  {
    "solo@skerry.io": {
      password: "solo123",
      user: {
        id: "demo:solo@skerry.io",
        name: "Solo User",
        email: "solo@skerry.io",
        role: "user",
        tier: "solo",
      },
    },
    "team@skerry.io": {
      password: "team123",
      user: {
        id: "demo:team@skerry.io",
        name: "Team User",
        email: "team@skerry.io",
        role: "user",
        tier: "team",
      },
    },
    "agency@skerry.io": {
      password: "agency123",
      user: {
        id: "demo:agency@skerry.io",
        name: "Agency User",
        email: "agency@skerry.io",
        role: "user",
        tier: "agency",
      },
    },
    "dev@skerry.io": {
      password: "skerry-dev-2024",
      user: {
        id: "demo:dev@skerry.io",
        name: "Developer",
        email: "dev@skerry.io",
        role: "developer",
        tier: "agency",
      },
    },
  };

const loginAttempts = new Map<string, { count: number; firstAt: number }>();
const TIER_LIMITS: Record<AccountTier, { monthlyRuns: number; maxLeadsPerRun: number; leads: number; seats: number; workspaces: number; exports: number; sends: number; apiCalls: number }> = {
  solo: { monthlyRuns: 50, maxLeadsPerRun: 5, leads: 100, seats: 1, workspaces: 1, exports: 10, sends: 50, apiCalls: 1000 },
  team: { monthlyRuns: 250, maxLeadsPerRun: 20, leads: 1000, seats: 5, workspaces: 3, exports: 100, sends: 500, apiCalls: 10000 },
  agency: { monthlyRuns: 1000, maxLeadsPerRun: 50, leads: -1, seats: 20, workspaces: 10, exports: -1, sends: -1, apiCalls: -1 },
};
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS ?? 12000);
const PROVIDER_RETRIES = Number(process.env.PROVIDER_RETRIES ?? 2);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function httpError(
  statusCode: number,
  message: string
): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function getRequestId(req: express.Request): string {
  return (
    (req as RequestWithContext).ctx?.requestId ??
    req.get("x-request-id") ??
    makeRequestId()
  );
}

/** Unified error response format for all API endpoints. */
function unifiedError(
  res: express.Response,
  code: string,
  message: string,
  statusCode: number = 400,
  requestId?: string
): void {
  res.status(statusCode).json({ ok: false, code, message, requestId });
}

/** Unified error response for auth-required errors. */
function unifiedAuthError(res: express.Response, requestId?: string): void {
  unifiedError(res, "AUTH_REQUIRED", "Authentication required", 401, requestId);
}

/** Unified error response for validation errors. */
function unifiedValidationError(res: express.Response, field?: string, requestId?: string): void {
  const message = field ? `Invalid ${field}` : "Invalid request";
  unifiedError(res, "VALIDATION_ERROR", message, 400, requestId);
}

/** Unified error response for resource not found. */
function unifiedNotFoundError(res: express.Response, resource: string, requestId?: string): void {
  unifiedError(res, "NOT_FOUND", `${resource} not found`, 404, requestId);
}

/** Unified error response for permission denied. */
function unifiedPermissionError(res: express.Response, requestId?: string): void {
  unifiedError(res, "PERMISSION_DENIED", "Insufficient permissions", 403, requestId);
}

/** Unified error response for rate limiting. */
function unifiedRateLimitError(res: express.Response, message: string = "Too many requests. Please retry shortly.", requestId?: string): void {
  unifiedError(res, "RATE_LIMITED", message, 429, requestId);
}

/** Unified error response for service unavailable. */
function unifiedServiceUnavailable(res: express.Response, message: string = "Service temporarily unavailable.", requestId?: string): void {
  unifiedError(res, "SERVICE_UNAVAILABLE", message, 503, requestId);
}

function readWorkspaceIdFromRequest(req: express.Request): string | null {
  const headerValue = req.get("x-workspace-id");
  if (headerValue && headerValue.trim().length > 0) return headerValue.trim();
  const bodyAny = req.body as Record<string, unknown> | undefined;
  const bodyValue =
    typeof bodyAny?.workspaceId === "string" ? bodyAny.workspaceId : undefined;
  if (bodyValue && bodyValue.trim().length > 0) return bodyValue.trim();
  const queryAny = req.query as Record<string, unknown> | undefined;
  const queryValue =
    typeof queryAny?.workspaceId === "string"
      ? queryAny.workspaceId
      : undefined;
  if (queryValue && queryValue.trim().length > 0) return queryValue.trim();
  return null;
}

async function getUserWorkspaceMembership(
  userEmail: string,
  workspaceId: string
): Promise<{ role?: string } | null> {
  if (!admin) return null;
  const { data, error } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_email", userEmail)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return { role: (data[0] as { role?: string }).role };
}

async function assertWorkspaceAccess(
  req: express.Request,
  user: AuthSessionUser,
  workspaceId: string
): Promise<{ role?: string }> {
  if (!admin) {
    if (workspaceId !== "demo-workspace") {
      throw httpError(403, "Workspace access denied.");
    }
    const role = process.env.DEMO_WORKSPACE_ROLE;
    if (role === "owner" || role === "admin" || role === "member" || role === "viewer") {
      return { role };
    }
    return { role: "owner" };
  }
  const uuidSchema = z.string().uuid();
  const parsed = uuidSchema.safeParse(workspaceId);
  if (!parsed.success) {
    throw httpError(400, "Invalid workspace id.");
  }
  const membership = await getUserWorkspaceMembership(user.email, workspaceId);
  if (!membership) {
    throw httpError(403, "Workspace access denied.");
  }
  return membership;
}

function normalizeWorkspaceRole(role: string | undefined): WorkspaceRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "member") return "member";
  return "viewer";
}

const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

function workspaceRoleAtLeast(
  actual: WorkspaceRole,
  required: WorkspaceRole
): boolean {
  return WORKSPACE_ROLE_RANK[actual] >= WORKSPACE_ROLE_RANK[required];
}

function requireWorkspaceRole(req: express.Request, required: WorkspaceRole): void {
  const role = (req as RequestWithContext).ctx?.workspaceRole;
  if (!role || !workspaceRoleAtLeast(role, required)) {
    throw httpError(403, "Insufficient workspace permissions.");
  }
}

async function resolveWorkspaceId(
  req: express.Request,
  user: AuthSessionUser
): Promise<string> {
  const requestId = getRequestId(req);
  const candidate = readWorkspaceIdFromRequest(req);
  if (candidate) {
    const membership = await assertWorkspaceAccess(req, user, candidate);
    (req as RequestWithContext).ctx = {
      requestId,
      workspaceId: candidate,
      workspaceRole: normalizeWorkspaceRole(membership.role),
    };
    return candidate;
  }
  if (!admin) {
    const fallback = "demo-workspace";
    const role = normalizeWorkspaceRole(process.env.DEMO_WORKSPACE_ROLE);
    (req as RequestWithContext).ctx = {
      requestId,
      workspaceId: fallback,
      workspaceRole: role,
    };
    return fallback;
  }
  throw httpError(400, "workspaceId is required.");
}

async function assertWorkspaceAccessWithContext(
  req: express.Request,
  user: AuthSessionUser,
  workspaceId: string
): Promise<WorkspaceRole> {
  const membership = await assertWorkspaceAccess(req, user, workspaceId);
  const role = normalizeWorkspaceRole(membership.role);
  const prev = (req as RequestWithContext).ctx;
  const requestId = prev?.requestId ?? getRequestId(req);
  (req as RequestWithContext).ctx = {
    requestId,
    workspaceId,
    workspaceRole: role,
  };
  return role;
}

async function assertWorkspaceOwner(
  req: express.Request,
  user: AuthSessionUser,
  workspaceId: string
): Promise<void> {
  await assertWorkspaceAccessWithContext(req, user, workspaceId);
  requireWorkspaceRole(req, "owner");
}

function asyncHandler(
  fn: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => Promise<unknown>
): express.RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch((err: unknown) => {
      const requestId =
        (req as any).ctx?.requestId ??
        req.get("x-request-id") ??
        makeRequestId();
      
      const status = err instanceof SyntaxError ? 400 : 500;
      const message = err instanceof Error ? err.message : String(err);
      
      if (status >= 500) {
        logEvent("error", "unhandled_async_error", {
          requestId,
          error: message,
          stack: err instanceof Error ? err.stack : undefined,
        });
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { requestId },
          extra: { path: req.path, method: req.method },
        });
      }
      
      if (!res.headersSent) {
        const errorContract = createError(
          ErrorCode.INTERNAL_ERROR,
          process.env.NODE_ENV === "production" && status >= 500
            ? "Internal server error."
            : message,
          requestId
        );
        res.status(status).json(errorContract);
      }
    });
  };
}

/** JSON error bodies: hide internals outside production. */
function clientSafeError(err: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return "Service temporarily unavailable.";
  }
  return err instanceof Error ? err.message : String(err);
}

function clientSafeWarning(_err: unknown): string {
  return process.env.NODE_ENV === "production"
    ? "Upstream check unavailable."
    : String(_err);
}

async function fetchWithTimeoutRetry(
  url: string,
  init: RequestInit,
  options: {
    timeoutMs: number;
    retries: number;
    requestId: string;
    provider: string;
  }
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) return resp;
      if (resp.status >= 500 && attempt < options.retries) {
        continue;
      }
      return resp;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt >= options.retries) break;
      logEvent("warn", "provider_retry", {
        requestId: options.requestId,
        provider: options.provider,
        attempt: attempt + 1,
        error: String(err),
      });
    }
  }
  throw new Error(
    `Provider request failed (${options.provider}): ${String(lastErr)}`
  );
}

function signSession(payload: SessionPayload): string {
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required.");
  }
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verifySession(token: string): SessionPayload | null {
  if (!SESSION_SECRET) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookie(req: express.Request, name: string): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const chunk = cookie
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  if (!chunk) return null;
  return decodeURIComponent(chunk.slice(name.length + 1));
}

function isSecureRequest(req: express.Request): boolean {
  return req.protocol === "https" || req.get("x-forwarded-proto") === "https";
}

function getSessionUser(req: express.Request): AuthSessionUser | null {
  const token = parseCookie(req, AUTH_COOKIE_NAME);
  if (!token) return null;
  const payload = verifySession(token);
  return payload?.user ?? null;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getWorkspaceTier(workspaceId: string): Promise<AccountTier> {
  if (!admin) return "solo";
  const { data } = await admin
    .from("workspaces")
    .select("plan_tier")
    .eq("id", workspaceId)
    .single();
  return (data?.plan_tier as AccountTier) ?? "solo";
}

function createCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function setCsrfCookie(
  req: express.Request,
  res: express.Response,
  token: string
): void {
  const cookie = [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Lax",
    isSecureRequest(req) ? "Secure" : "",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
    .filter(Boolean)
    .join("; ");
  res.append("Set-Cookie", cookie);
}

function clearAuthCookies(req: express.Request, res: express.Response): void {
  const secure = isSecureRequest(req) ? "Secure" : "";
  const authCookie = [
    `${AUTH_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    secure,
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
  const csrfCookie = [
    `${CSRF_COOKIE_NAME}=`,
    "Path=/",
    "SameSite=Lax",
    secure,
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
  res.append("Set-Cookie", authCookie);
  res.append("Set-Cookie", csrfCookie);
}

function synthesizeServerLeads(params: {
  count: number;
  tier: AccountTier;
  businessDescription?: string;
  targetAudience?: string;
}): GeneratedLead[] {
  const firstNames = [
    "Aria",
    "Marcus",
    "Priya",
    "Devon",
    "Sana",
    "Jules",
    "Kai",
    "Mira",
  ];
  const lastNames = [
    "Voss",
    "Tan",
    "Raman",
    "Reyes",
    "Okafor",
    "Nilsson",
    "Grant",
    "Kim",
  ];
  const titlesByTier: Record<AccountTier, string[]> = {
    solo: ["Founder", "Co-Founder", "Marketing Lead"],
    team: ["VP of Growth", "Head of Marketing", "Director of Demand Gen"],
    agency: ["Chief Revenue Officer", "Head of GTM", "VP of Strategy"],
  };
  const orgs = [
    {
      name: "Helios Labs",
      website: "helioslabs.io",
      domain: "renewable analytics",
    },
    {
      name: "Lattice Health",
      website: "latticehealth.co",
      domain: "health data infra",
    },
    {
      name: "Polaris Data",
      website: "polarisdata.ai",
      domain: "ML observability",
    },
    {
      name: "Aether Logistics",
      website: "aetherlogistics.io",
      domain: "AI freight matching",
    },
  ];

  const leads: GeneratedLead[] = [];
  for (let i = 0; i < params.count; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[(i * 3) % lastNames.length];
    const title =
      titlesByTier[params.tier][i % titlesByTier[params.tier].length];
    const org = orgs[i % orgs.length];
    leads.push({
      firstName,
      lastName,
      title,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${org.website}`,
      linkedin: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      organization: { name: org.name, website: org.website },
      websiteContext: `${org.name} is active in ${org.domain} and signals enterprise GTM maturity.`,
      personContext: `${firstName} appears relevant for ${
        params.businessDescription?.slice(0, 50) ?? "your outreach"
      }. ${params.targetAudience ? `Target fit: ${params.targetAudience}.` : ""}`,
      uniqueAngles: [
        "Category shift",
        "Pipeline efficiency",
        "Strategic positioning",
      ],
    });
  }
  return leads;
}

async function generateLeadsWithOpenAI(params: {
  apiKey: string;
  count: number;
  tier: AccountTier;
  businessDescription: string;
  targetAudience: string;
  requestId: string;
}): Promise<GeneratedLead[]> {
  const depthInstruction =
    params.tier === "solo"
      ? "Generate basic lead profiles with minimal context."
      : params.tier === "team"
        ? "Generate detailed lead profiles with website context and LinkedIn enrichment."
        : "Generate highly detailed lead profiles with strategic and intent-oriented angles.";

  const prompt = `You are a B2B lead generation AI. Generate ${params.count} realistic lead profiles.
Business Description: ${params.businessDescription}
Target Audience: ${params.targetAudience}
Research Depth: ${depthInstruction}

Return a JSON array of leads. Each lead must have:
- firstName, lastName
- title
- email
- linkedin
- organization: { name, website }
- websiteContext
- personContext
- uniqueAngles (array of 3 short strings)

Return ONLY valid JSON array.`;

  const resp = await fetchWithTimeoutRetry(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      retries: PROVIDER_RETRIES,
      requestId: params.requestId,
      provider: "openai",
    }
  );
  if (!resp.ok) {
    throw new Error(`OpenAI request failed (${resp.status})`);
  }
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "[]";
  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(cleaned) as GeneratedLead[];
  return Array.isArray(parsed) ? parsed : [];
}

function synthesizeServerEmail(params: {
  firstName: string;
  organizationName: string;
  angle: string;
  senderName: string;
}): string {
  return `**Subject:** Quick idea for ${params.organizationName}

Hi ${params.firstName},

Noticed your team is leaning into ${params.angle.toLowerCase()}. We put together a short teardown on how similar teams are turning that into qualified pipeline without adding process overhead.

If useful, I can send it over.

Best,
${params.senderName}`;
}

async function generateEmailWithOpenAI(params: {
  apiKey: string;
  lead: {
    firstName: string;
    lastName: string;
    title: string;
    organizationName: string;
    websiteContext: string;
    personContext: string;
    uniqueAngles: string[];
  };
  businessDescription: string;
  senderName: string;
  angle?: string;
  requestId: string;
}): Promise<string> {
  const angle =
    params.angle ?? params.lead.uniqueAngles[0] ?? "value proposition";
  const prompt = `You are an expert cold email copywriter specializing in asset-based outreach.

Write a highly personalized cold email for the following lead:
- Name: ${params.lead.firstName} ${params.lead.lastName}
- Title: ${params.lead.title} at ${params.lead.organizationName}
- Company Context: ${params.lead.websiteContext}
- Person Context: ${params.lead.personContext}
- Strategic Angle: ${angle}

Sender's Business: ${params.businessDescription}
Sender Name: ${params.senderName}

Requirements:
- Subject line that references something specific about their company
- Opening that shows genuine research
- 2-3 short sentences connecting their situation to sender value
- Soft CTA
- Total length: 80-120 words
- Tone: professional but conversational, not salesy

Format as Markdown with **Subject:** on the first line, then the email body.`;

  const resp = await fetchWithTimeoutRetry(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      retries: PROVIDER_RETRIES,
      requestId: params.requestId,
      provider: "openai",
    }
  );
  if (!resp.ok) throw new Error(`OpenAI request failed (${resp.status})`);
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Lightweight markdown → HTML for transactional email. */
function mdToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /^# (.+)$/gm,
      '<h1 style="font-size:24px;margin:0 0 16px;color:#0a1628;">$1</h1>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.18em;margin:24px 0 8px;color:#0891b2;">$1</h2>'
    )
    .replace(
      /^&gt; (.+)$/gm,
      '<blockquote style="border-left:3px solid #06b6d4;padding-left:12px;color:#475569;margin:16px 0;">$1</blockquote>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /^---$/gm,
      '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />'
    );
  html = html
    .split(/\n{2,}/)
    .map(para =>
      /^\s*<(h1|h2|blockquote|hr)/.test(para)
        ? para
        : `<p style="margin:0 0 12px;line-height:1.5;color:#1e293b;">${para.replace(/\n/g, "<br/>")}</p>`
    )
    .join("\n");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;">${html}</div>`;
}

function mdToText(md: string): string {
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^---$/gm, "");
}

function extractSubjectAndBody(md: string): { subject: string; body: string } {
  const m = md.match(/^\s*\*\*Subject:\*\*\s*(.+?)\n([\s\S]*)$/);
  if (m) return { subject: m[1].trim(), body: m[2].trim() };
  const firstH1 = md.match(/^#\s+(.+)$/m);
  return { subject: firstH1 ? firstH1[1].trim() : "Quick note", body: md };
}

export async function buildApp(): Promise<express.Express> {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters long."
    );
  }
  assertEnterpriseProductionConfig();

  const app = express();
  app.disable("x-powered-by");

  // Sentry request handlers (must be first)
  const entitlementDb = new EntitlementDb({
    databaseUrl: process.env.DATABASE_URL,
  });
  await entitlementDb.init();

  // Initialize Upstash rate limiter with sliding window
  // - Workspace-level: rl:workspace:{workspaceId}:{endpoint}
  // - User-level on auth endpoints (Login 5/15min, Password-Reset 3/h)
  // - Falls back to in-memory if UPSTASH_REDIS_URL not set
  const useUpstash = isUpstashConfigured();
  console.log(`[RateLimit] Using ${useUpstash ? "Upstash Redis" : "in-memory fallback"} for rate limiting`);

  // Workspace-level rate limiter for all /api/* endpoints
  const workspaceLimiter = workspaceRateLimit("global");

  // Auth-level rate limiters
  const loginLimiter = authRateLimit("login");
  const passwordResetLimiter = authRateLimit("password-reset");
  const registerLimiter = authRateLimit("register");

  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = ["'self'"];
  if (!isProd) {
    scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
  }

  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc,
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:", "wss:", "ws:"],
          frameSrc: ["'self'", "https:"],
          workerSrc: ["'self'", "blob:"],
          upgradeInsecureRequests: isProd ? [] : null,
        },
      },
      crossOriginResourcePolicy: false,
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  
  // Apply workspace-level rate limiting to all API routes
  app.use("/api", workspaceLimiter);

  // Default: reflect any Origin (dev). Set SKERRY_ALLOWED_ORIGINS to restrict credentialed API.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = parseAllowedOrigins();
    if (origin && !isOriginAllowed(origin, allowedOrigins)) {
      if (req.method === "OPTIONS") return res.sendStatus(403);
      if (req.path.startsWith("/api/")) {
        return unifiedError(res, "ORIGIN_NOT_ALLOWED", "Origin not allowed.", 403);
      }
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,X-CSRF-Token,X-Workspace-Id,X-Request-Id"
    );
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use((req, res, next) => {
    const requestId = req.get("x-request-id") || makeRequestId();
    (req as RequestWithContext).ctx = { requestId };
    res.setHeader("x-request-id", requestId);
    // Set requestId as Sentry tag for every request
    Sentry.getCurrentScope().setTag("requestId", requestId);
    const startedAt = Date.now();
    res.on("finish", () => {
      logEvent("info", "http_request", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    if (!req.path.startsWith("/api/")) return next();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (req.path === "/api/auth/login" || req.path === "/api/auth/csrf")
      return next();
    const csrfCookie = parseCookie(req, CSRF_COOKIE_NAME);
    const csrfHeader = req.get("x-csrf-token");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return unifiedError(res, "CSRF_INVALID", "CSRF token invalid or missing.", 403);
    }
    return next();
  });

  // ──────────── /api/auth/login
  // ──────────── /api/auth/login
  // Note: Schemas are now imported from ./middleware/validation.js

  app.post("/api/auth/login", loginLimiter, validate({ body: loginSchema }), (req, res) => {
    const { email, password } = (req as any).body as LoginBody;
    if (!ALLOW_DEMO_AUTH) {
      return unifiedError(
        res,
        "AUTH_NOT_CONFIGURED",
        "Auth provider not configured. Set ALLOW_DEMO_AUTH=true only for controlled dev.",
        503
      );
    }
    const normalizedEmail = email.trim().toLowerCase();
    const ip = req.ip ?? "unknown_ip";
    const attemptKey = `${ip}:${normalizedEmail}`;
    const now = Date.now();
    const attempt = loginAttempts.get(attemptKey);
    if (attempt) {
      const elapsed = now - attempt.firstAt;
      if (elapsed > LOGIN_WINDOW_MS) {
        loginAttempts.delete(attemptKey);
      } else if (attempt.count >= LOGIN_MAX_ATTEMPTS) {
        return unifiedRateLimitError(
          res,
          "Too many login attempts. Try again in a few minutes."
        );
      }
    }

    const match = DEMO_USERS[normalizedEmail];
    if (!match || match.password !== password) {
      const prev = loginAttempts.get(attemptKey);
      if (!prev) {
        loginAttempts.set(attemptKey, { count: 1, firstAt: now });
      } else {
        loginAttempts.set(attemptKey, {
          count: prev.count + 1,
          firstAt: prev.firstAt,
        });
      }
      return unifiedError(res, "INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    loginAttempts.delete(attemptKey);

    const payload: SessionPayload = {
      user: match.user,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    };
    const token = signSession(payload);
    const csrfToken = createCsrfToken();
    const cookie = [
      `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      isSecureRequest(req) ? "Secure" : "",
      `Max-Age=${SESSION_TTL_SECONDS}`,
    ]
      .filter(Boolean)
      .join("; ");
    res.append("Set-Cookie", cookie);
    setCsrfCookie(req, res, csrfToken);
    return res.json({ ok: true, user: match.user, csrfToken });
  });

  app.get("/api/auth/csrf", (req, res) => {
    const token = parseCookie(req, AUTH_COOKIE_NAME);
    if (!token || !verifySession(token)) {
      return unifiedAuthError(res);
    }
    const csrfToken = createCsrfToken();
    setCsrfCookie(req, res, csrfToken);
    return res.json({ ok: true, csrfToken });
  });

  // ──────────── /api/auth/session
  app.get("/api/auth/session", (req, res) => {
    const token = parseCookie(req, AUTH_COOKIE_NAME);
    if (!token)
      return unifiedAuthError(res);
    const payload = verifySession(token);
    if (!payload)
      return unifiedError(res, "SESSION_EXPIRED", "Session expired", 401);
    const csrfToken = createCsrfToken();
    setCsrfCookie(req, res, csrfToken);
    return res.json({ ok: true, user: payload.user, csrfToken });
  });

  // ──────────── /api/auth/logout
  app.post("/api/auth/logout", validate({ body: z.object({}) }), (req, res) => {
    clearAuthCookies(req, res);
    return res.json({ ok: true });
  });

  const requireAuth: express.RequestHandler = (req, res, next) => {
    const user = getSessionUser(req);
    if (!user) {
      return unifiedAuthError(res);
    }
    return next();
  };

  // ──────────── /api/workspaces
  app.get(
    "/api/workspaces",
    requireAuth,
    validate({ query: workspacesQuerySchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      // If Supabase is configured, fetch real workspaces
      if (admin) {
        try {
          // Query workspace_members for the current user
          const { data: memberships, error: memberError } = await admin
            .from("workspace_members")
            .select(
              `
              workspace_id,
              role,
              workspaces (
                id,
                name,
                plan_tier,
                slug
              )
            `
            )
            .eq("user_email", user.email);

          if (memberError) throw memberError;

          const workspaces =
            memberships
              ?.map(m => {
                const workspace = (m as any).workspaces;
                if (!workspace) return null;
                return {
                  ...workspace,
                  role: normalizeWorkspaceRole((m as any).role),
                };
              })
              .filter(Boolean) || [];
          return res.json({ ok: true, workspaces });
        } catch (err) {
          logEvent("error", "workspaces_fetch_failed", {
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
            error: String(err),
          });
          return unifiedError(res, "WORKSPACES_FETCH_FAILED", "Failed to fetch workspaces", 502);
        }
      }

      // Fallback: return demo workspace
      const role = normalizeWorkspaceRole(process.env.DEMO_WORKSPACE_ROLE);
      return res.json({
        ok: true,
        workspaces: [
          {
            id: "demo-workspace",
            name: "Demo Workspace",
            plan_tier: user.tier,
            slug: "demo",
            role,
          },
        ],
      });
    })
  );

  // ──────────── /api/workspaces/:id/icp
  app.get(
    "/api/workspaces/:id/icp",
    requireAuth,
    validate({ params: commonSchemas.workspaceIdParam }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };
      const targetWorkspaceId = id;
      await assertWorkspaceAccess(req, user, targetWorkspaceId);

      // If Supabase is configured, fetch real ICP profile
      if (admin) {
        try {
          const { data, error } = await admin
            .from("icp_profiles")
            .select("business_description, ideal_customer, problem_solved")
            .eq("workspace_id", targetWorkspaceId)
            .single();

          if (data && !error) {
            return res.json({ ok: true, icp: data });
          }
        } catch (err) {
          logEvent("error", "icp_fetch_failed", {
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
            error: String(err),
          });
        }
      }

      // Fallback: return null (client will use localStorage)
      return res.json({ ok: true, icp: null });
    })
  );

  app.post(
    "/api/workspaces/:id/icp",
    requireAuth,
    validate({ params: commonSchemas.workspaceIdParam, body: updateICPSchema }),
    asyncHandler(async (req, res) => {
      const { business_description, ideal_customer, problem_solved } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };

      const targetWorkspaceId = id;
      await assertWorkspaceAccessWithContext(req, user, targetWorkspaceId);
      requireWorkspaceRole(req, "admin");

      // If Supabase is configured, save ICP profile
      if (admin) {
        try {
          const { error } = await admin.from("icp_profiles").upsert(
            {
              workspace_id: targetWorkspaceId,
              business_description,
              ideal_customer,
              problem_solved,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "workspace_id",
            }
          );

          if (error) throw error;

          return res.json({ ok: true });
        } catch (err) {
          logEvent("error", "icp_save_failed", {
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
            error: String(err),
          });
          return unifiedError(res, "ICP_SAVE_FAILED", "Failed to save ICP profile", 502);
        }
      }

      // Fallback: success (client will keep using localStorage)
      return res.json({ ok: true, fallback: "localStorage" });
    })
  );

  // ──────────── /api/entitlements/usage
  app.get(
    "/api/entitlements/usage",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }
      if (!entitlementDb.isConfigured) {
        return unifiedServiceUnavailable(res, "DATABASE_URL is required for entitlements.");
      }
      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");
      try {
        const workspaceTier = await getWorkspaceTier(workspaceId);
        const limits = TIER_LIMITS[workspaceTier];
        const usageMonth = getCurrentMonthKey();
        const usage = await entitlementDb.getWorkspaceUsage(workspaceId, usageMonth);
        return res.json({
          ok: true,
          tier: workspaceTier,
          usageMonth,
          leadsUsed: usage.leads,
          monthlyLeads: limits.leads,
          leadsRemaining: limits.leads === -1 ? -1 : Math.max(limits.leads - usage.leads, 0),
          exportsUsed: usage.exports,
          monthlyExports: limits.exports,
          exportsRemaining: limits.exports === -1 ? -1 : Math.max(limits.exports - usage.exports, 0),
          sendsUsed: usage.sends,
          monthlySends: limits.sends,
          sendsRemaining: limits.sends === -1 ? -1 : Math.max(limits.sends - usage.sends, 0),
          apiCallsUsed: usage.apiCalls,
          monthlyApiCalls: limits.apiCalls,
          apiCallsRemaining: limits.apiCalls === -1 ? -1 : Math.max(limits.apiCalls - usage.apiCalls, 0),
          maxLeadsPerRun: limits.maxLeadsPerRun,
        });
      } catch (err) {
        logEvent("error", "entitlements_usage_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "ENTITLEMENT_USAGE_FAILED", clientSafeError(err), 502);
      }
    })
  );

  // ──────────── /api/entitlements/research/start
  app.post(
    "/api/entitlements/research/start",
    requireAuth,
    validate({ body: entitlementStartSchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }
      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");
      const workspaceTier = await getWorkspaceTier(workspaceId);
      const limits = TIER_LIMITS[workspaceTier];
      const { requestedLeads } = (req as any).body as EntitlementStartBody;
      const requested = Math.max(
        1,
        Number(requestedLeads ?? limits.maxLeadsPerRun)
      );
      if (requested > limits.maxLeadsPerRun) {
        return unifiedError(
          res,
          "MAX_LEADS_PER_RUN_EXCEEDED",
          `Plan allows max ${limits.maxLeadsPerRun} leads per run.`,
          400
        );
      }

      if (!entitlementDb.isConfigured) {
        return unifiedServiceUnavailable(res, "DATABASE_URL is required for entitlements.");
      }
      try {
        const usageMonth = getCurrentMonthKey();
        const usage = await entitlementDb.getWorkspaceUsage(workspaceId, usageMonth);
        if (limits.leads !== -1 && usage.leads + requested > limits.leads) {
          return unifiedError(
            res,
            "MONTHLY_LEAD_LIMIT_REACHED",
            "Monthly lead limit reached. Upgrade plan or wait for next month.",
            403
          );
        }
        return res.json({
          ok: true,
          tier: workspaceTier,
          usageMonth,
          leadsUsed: usage.leads,
          monthlyLeads: limits.leads,
          leadsRemaining: limits.leads === -1 ? -1 : Math.max(limits.leads - usage.leads, 0),
          maxLeadsPerRun: limits.maxLeadsPerRun,
          requestedLeads: requested,
        });
      } catch (err) {
        logEvent("error", "entitlements_research_start_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "ENTITLEMENT_RESEARCH_START_FAILED", clientSafeError(err), 502);
      }
    })
  );

  // ──────────── /api/leads/generate
  app.post(
    "/api/leads/generate",
    requireAuth,
    validate({ body: generateLeadsSchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }
      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");
      if (!entitlementDb.isConfigured) {
        return unifiedServiceUnavailable(res, "DATABASE_URL is required for entitlements.");
      }
      const workspaceTier = await getWorkspaceTier(workspaceId);
      const limits = TIER_LIMITS[workspaceTier];
      const usageMonth = getCurrentMonthKey();
      const body = (req as any).body as GenerateLeadsBody;
      const requested = Math.max(
        1,
        Number(body.requestedLeads ?? limits.maxLeadsPerRun)
      );
      const count = Math.min(requested, limits.maxLeadsPerRun);
      const consumed = await entitlementDb.consumeWorkspaceEntitlements({
        workspaceId,
        tier: workspaceTier,
        usageMonth,
        feature: "leads",
        amount: count,
        limits,
      });
      if (!consumed.allowed) {
        return unifiedError(
          res,
          "MONTHLY_LEAD_LIMIT_REACHED",
          "Monthly lead limit reached. Upgrade plan or wait for next month.",
          403
        );
      }
      const businessDescription = (
        body.businessDescription ?? "B2B SaaS"
      ).trim();
      const targetAudience = (
        body.targetAudience ?? "Growth-stage startups"
      ).trim();

      let leads: GeneratedLead[] = [];
      let source: "apollo" | "openai" | "none" = "none";

      // Parse ICP from request (for now, use businessDescription and targetAudience)
      const parsedICP = {
        roles: [targetAudience], // Simple parsing - will be enhanced in Phase 3
        locations: undefined,
        companySizeRange: undefined,
      };

      // Priority 1: Apollo Discovery (legal, kostenlos, DSGVO-konform)
      if (process.env.APOLLO_API_KEY) {
        try {
          const result = await discoverLeads({
            icp: parsedICP,
            limit: count,
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          });

          // Map Apollo leads to existing GeneratedLead format
          leads = result.leads.map(lead => ({
            firstName: lead.firstName,
            lastName: lead.lastName,
            title: lead.title,
            email:
              lead.email ||
              `${lead.firstName.toLowerCase()}.${lead.lastName.toLowerCase()}@${lead.organization.website ? new URL(lead.organization.website).hostname : "example.com"}`,
            linkedin: lead.linkedin || "",
            organization: {
              name: lead.organization.name,
              website: lead.organization.website || "",
            },
            websiteContext: `${lead.organization.name} is active in ${targetAudience}. Professional profile from Apollo.io.`,
            personContext: `${lead.firstName} is a ${lead.title} at ${lead.organization.name}. Relevant for ${businessDescription}.`,
            uniqueAngles: [
              "Strategic Partnership",
              "Technology Integration",
              "Market Expansion",
            ],
          }));
          source = "apollo";
        } catch (err) {
          if (err instanceof Error && err.message === "OPENAI_FALLBACK") {
            // Continue to OpenAI fallback below
            leads = [];
          } else {
            logEvent("warn", "apollo_discovery_failed", {
              requestId:
                (req as RequestWithContext).ctx?.requestId ?? "unknown",
              error: String(err),
            });
          }
        }
      }

      // Priority 2: OpenAI Lead Generation (Fallback wenn kein Apollo oder Apollo fehlgeschlagen)
      if (leads.length === 0 && process.env.OPENAI_API_KEY) {
        try {
          leads = await generateLeadsWithOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            count,
            tier: user.tier,
            businessDescription,
            targetAudience,
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          });
          source = "openai";
        } catch (err) {
          logEvent("warn", "openai_leads_failed", {
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
            error: String(err),
          });
        }
      }

      // No provider available
      if (leads.length === 0) {
        return unifiedServiceUnavailable(res, "Kein Discovery-Provider konfiguriert.");
      }

      await logAudit({
        workspaceId,
        userId: user.id,
        action: "lead.discovery_completed",
        resourceType: "lead",
        metadata: {
          source,
          count: leads.length,
        },
      });

      return res.json({
        ok: true,
        source,
        leads,
        tier: workspaceTier,
        usageMonth,
        leadsUsed: consumed.usage.leads,
        monthlyLeads: limits.leads,
        leadsRemaining: limits.leads === -1 ? -1 : Math.max(limits.leads - consumed.usage.leads, 0),
        maxLeadsPerRun: limits.maxLeadsPerRun,
      });
    })
  );

  // ──────────── /api/leads/enrich
  app.post(
    "/api/leads/enrich",
    requireAuth,
    validate({ body: enrichLeadsSchema }),
    asyncHandler(async (req, res) => {
      const { leadIds } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      try {
        const targetWorkspaceId = await resolveWorkspaceId(req, user);
        requireWorkspaceRole(req, "member");

        if (!entitlementDb.isConfigured) {
          return unifiedServiceUnavailable(res, "DATABASE_URL is required for entitlements.");
        }

        const workspaceTier = await getWorkspaceTier(targetWorkspaceId);
        const limits = TIER_LIMITS[workspaceTier];
        const usageMonth = getCurrentMonthKey();

        // Get limits and consume apiCalls
        const currentUsage = await entitlementDb.getWorkspaceUsage(targetWorkspaceId, usageMonth);
        const consumed = await entitlementDb.consumeWorkspaceEntitlements({
          workspaceId: targetWorkspaceId,
          tier: workspaceTier,
          usageMonth,
          feature: "apiCalls",
          amount: leadIds.length,
          limits,
        });
        if (!consumed.allowed) {
          return unifiedError(
            res,
            "MONTHLY_API_CALL_LIMIT_REACHED",
            "Monthly API call limit reached. Upgrade plan or wait for next month.",
            403
          );
        }

        if (!admin) {
          return res.json({
            ok: true,
            enriched: false,
            reason: "no_db",
          });
        }

        // Fetch leads from DB
        const { data: leads, error } = await admin
          .from("leads")
          .select("*")
          .in("id", leadIds)
          .eq("workspace_id", targetWorkspaceId);

        if (error || !leads) {
          return unifiedError(res, "LEADS_FETCH_FAILED", "Failed to fetch leads", 500);
        }

        const enrichedLeads = [];

        for (const lead of leads) {
          const leadData = {
            id: lead.id,
            personal: {
              firstName: lead.first_name,
              lastName: lead.last_name,
              title: lead.title,
              email: lead.email,
            },
            organization: {
              name: lead.company_name,
              domain: lead.company_website,
            },
          };

          const enriched = await enrichLead(leadData);
          const intentScore = calculateIntentScore([]); // Initial: no events, score 0

          // Update DB
          const { error: updateError } = await admin
            .from("leads")
            .update({
              enriched_data: enriched,
              intent_score: intentScore,
            })
            .eq("id", lead.id)
            .eq("workspace_id", targetWorkspaceId);

          if (updateError) {
            console.error("Failed to update lead:", updateError);
            continue;
          }

          enrichedLeads.push({
            id: lead.id,
            enriched,
            intentScore,
          });
        }

        await logAudit({
          workspaceId: targetWorkspaceId,
          userId: user.id,
          action: "lead.enriched",
          resourceType: "lead",
          metadata: {
            count: enrichedLeads.length,
          },
        });

        return res.json({
          ok: true,
          enriched: enrichedLeads,
          tier: workspaceTier,
          usageMonth,
          apiCallsUsed: consumed.usage.apiCalls,
          monthlyApiCalls: limits.apiCalls,
          apiCallsRemaining: limits.apiCalls === -1 ? -1 : Math.max(limits.apiCalls - consumed.usage.apiCalls, 0),
        });
      } catch (err) {
        console.error("Enrichment error:", err);
        return unifiedError(res, "ENRICHMENT_FAILED", "Enrichment failed", 500);
      }
    })
  );

  // ──────────── /api/leads/persist
  app.post(
    "/api/leads/persist",
    requireAuth,
    validate({ body: persistLeadsSchema }),
    asyncHandler(async (req, res) => {
      const { leads } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      try {
        const targetWorkspaceId = await resolveWorkspaceId(req, user);
        requireWorkspaceRole(req, "member");
        if (!admin) {
          return res.json({
            ok: true,
            persisted: false,
            reason: "no_db",
          });
        }
        const leadsToInsert = leads.map((lead: any) => ({
          workspace_id: targetWorkspaceId,
          first_name: lead.firstName || lead.personal?.firstName,
          last_name: lead.lastName || lead.personal?.lastName,
          email: lead.email || lead.personal?.email,
          title: lead.title || lead.personal?.title,
          linkedin_url: lead.linkedin || lead.personal?.linkedin,
          company_name: lead.organization?.name || lead.organization?.name,
          company_website:
            lead.organization?.website || lead.organization?.website,
          website_context:
            lead.websiteContext || lead.extraction?.websiteContext,
          person_context: lead.personContext || lead.extraction?.personContext,
          unique_angles: lead.uniqueAngles || lead.extraction?.uniqueAngles,
          newsletter_body: lead.newsletter?.body,
          stage: lead.stage || "source",
          intent_score: 0,
          created_at: new Date().toISOString(),
        }));

        const { error } = await admin.from("leads").insert(leadsToInsert);

        if (error) throw error;

        return res.json({
          ok: true,
          persisted: true,
          count: leadsToInsert.length,
        });
      } catch (err) {
        logEvent("error", "leads_persist_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "LEADS_PERSIST_FAILED", "Failed to persist leads", 502);
      }
    })
  );

  // ──────────── /api/dev/seed-leads (development only)
  if (process.env.NODE_ENV === "development") {
    app.post(
      "/api/dev/seed-leads",
      requireAuth,
      validate({ body: seedLeadsSchema }),
      asyncHandler(async (req, res) => {
        const {
          count = 5,
          businessDescription = "B2B SaaS",
          targetAudience = "Growth-stage startups",
        } = (req as any).body;
        const user = getSessionUser(req);
        if (!user) {
          return unifiedAuthError(res);
        }

        const leads = synthesizeServerLeads({
          count: Math.min(count, 20),
          tier: user.tier,
          businessDescription,
          targetAudience,
        });

        return res.json({
          ok: true,
          source: "synthesizer",
          leads,
          development: true,
        });
      })
    );
  }

  // ──────────── /api/email/generate
  app.post(
    "/api/email/generate",
    requireAuth,
    validate({ body: generateEmailSchema }),
    asyncHandler(async (req, res) => {
      const body = (req as any).body as GenerateEmailBody;
      const lead = body.lead ?? {};
      const firstName = (lead.firstName ?? "").trim();
      const lastName = (lead.lastName ?? "").trim();
      const title = (lead.title ?? "Executive").trim();
      const organizationName = (
        lead.organization?.name ?? "your company"
      ).trim();
      const websiteContext = (lead.websiteContext ?? "").trim();
      const personContext = (lead.personContext ?? "").trim();
      const uniqueAngles = Array.isArray(lead.uniqueAngles)
        ? lead.uniqueAngles.filter((a): a is string => typeof a === "string")
        : [];
      if (!firstName) {
        return unifiedValidationError(res, "lead.firstName");
      }

      const businessDescription = (
        body.businessDescription ?? "B2B SaaS company"
      ).trim();
      const senderName = (body.senderName ?? "Skerry").trim();
      const angle = (
        body.angle ??
        uniqueAngles[0] ??
        "value proposition"
      ).trim();
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return res.json({
          ok: true,
          source: "synthesizer",
          markdown: synthesizeServerEmail({
            firstName,
            organizationName,
            angle,
            senderName,
          }),
        });
      }

      try {
        const markdown = await generateEmailWithOpenAI({
          apiKey,
          lead: {
            firstName,
            lastName,
            title,
            organizationName,
            websiteContext,
            personContext,
            uniqueAngles,
          },
          businessDescription,
          senderName,
          angle,
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
        });
        if (!markdown) {
          throw new Error("Empty model response");
        }
        return res.json({ ok: true, source: "openai", markdown });
      } catch (err) {
        logEvent("warn", "openai_email_fallback", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return res.json({
          ok: true,
          source: "synthesizer",
          markdown: synthesizeServerEmail({
            firstName,
            organizationName,
            angle,
            senderName,
          }),
        });
      }
    })
  );

  // ──────────── /api/ready (DB ping when DATABASE_URL is set; for orchestrator readiness probes)
  app.get(
    "/api/ready",
    validate({ query: healthQuerySchema }),
    asyncHandler(async (_req, res) => {
      if (!entitlementDb.isConfigured) {
        return res.status(200).json({ ok: true, database: "not_configured" });
      }
      try {
        await entitlementDb.ping();
        return res.status(200).json({ ok: true, database: "ok" });
      } catch (err) {
        logEvent("error", "readiness_db_ping_failed", { error: String(err) });
        return unifiedError(res, "DB_PING_FAILED", "Database unavailable", 503);
      }
    })
  );

  // ──────────── /api/health
  app.get("/api/health", validate({ query: healthQuerySchema }), (_req, res) => {
    const hasApollo = Boolean(process.env.APOLLO_API_KEY);
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    
    // Get circuit breaker status for providers
    const providerHealth = getProvidersHealth();
    
    res.json({
      ok: true,
      version: "1.0.0",
      services: {
        apollo: hasApollo,
        openai: hasOpenAI,
        resend: Boolean(process.env.RESEND_API_KEY),
        neverbounce: Boolean(process.env.NEVERBOUNCE_API_KEY),
        supabase: Boolean(process.env.SUPABASE_URL),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      },
      circuits: providerHealth,
      discovery_provider: hasApollo ? "apollo" : hasOpenAI ? "openai" : "none",
      demo_mode: process.env.ALLOW_DEMO_AUTH === "true",
      ready_for_production: hasApollo && Boolean(process.env.SUPABASE_URL),
    });
  });

  // ──────────── /api/dev/test-exception (dev only, for Sentry testing)
  app.get("/api/dev/test-exception", (req, res) => {
    const requestId = getRequestId(req);
    // This exception will be caught by Sentry and the custom error handler
    throw new Error(
      `Test exception from /api/dev/test-exception - requestId: ${requestId} - email: test@example.com - name: John Doe`
    );
  });

  // ──────────── /api/billing/checkout
  app.post(
    "/api/billing/checkout",
    requireAuth,
    validate({ body: billingCheckoutSchema }),
    asyncHandler(async (req, res) => {
      const { priceId } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return unifiedError(
          res,
          "STRIPE_NOT_CONFIGURED",
          "Stripe ist noch nicht konfiguriert. Kommt bald.",
          503
        );
      }
      const allowedPriceIds = [
        process.env.STRIPE_PRICE_SOLO,
        process.env.STRIPE_PRICE_TEAM,
        process.env.STRIPE_PRICE_AGENCY,
      ].filter((v): v is string => Boolean(v));
      if (!allowedPriceIds.includes(priceId)) {
        return unifiedValidationError(res, "priceId");
      }

      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "owner");
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(stripeKey);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/billing?success=1`,
        cancel_url: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/billing`,
        metadata: {
          workspace_id: workspaceId,
          user_id: user.id,
        },
        subscription_data: {
          metadata: {
            workspace_id: workspaceId,
          },
        },
      });
      await logAudit({
        workspaceId,
        userId: user.id,
        action: "billing.checkout_started",
        resourceType: "billing",
        metadata: {
          priceId,
          stripeSessionId: session.id,
        },
      });
      return res.json({ ok: true, url: session.url });
    })
  );

  // ──────────── /api/billing/webhook
  app.post(
    "/api/billing/webhook",
    validate({ body: billingWebhookSchema }),
    asyncHandler(async (req, res) => {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripeKey || !webhookSecret) {
        return unifiedServiceUnavailable(res, "Stripe not configured");
      }

      const sig = req.headers["stripe-signature"] as string;
      if (!sig) {
        return unifiedError(res, "MISSING_SIGNATURE", "Missing signature", 400);
      }

      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(stripeKey);

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        return unifiedError(res, "INVALID_SIGNATURE", "Invalid signature", 400);
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const workspaceId = session.metadata?.workspace_id;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (workspaceId && !(await entitlementDb.isWebhookProcessed(event.id, workspaceId))) {
            if (admin && customerId && subscriptionId) {
              // Update workspace with subscription info
              await admin
                .from("workspaces")
                .update({
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", workspaceId);

              // Determine plan tier from price ID
              const priceId = session.display_items?.[0]?.price?.id;
              let planTier = "solo";
              if (priceId === process.env.STRIPE_PRICE_TEAM) planTier = "team";
              if (priceId === process.env.STRIPE_PRICE_AGENCY)
                planTier = "agency";

              await admin
                .from("workspaces")
                .update({ plan_tier: planTier })
                .eq("id", workspaceId);
            }
            await entitlementDb.recordWebhookProcessed(event.id, workspaceId, event.type, event.data.object);
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as any;
          const workspaceId = subscription.metadata?.workspace_id;

          if (workspaceId && !(await entitlementDb.isWebhookProcessed(event.id, workspaceId))) {
            if (admin) {
              let planTier = "solo";
              const priceId = subscription.items.data[0]?.price?.id;
              if (priceId === process.env.STRIPE_PRICE_TEAM) planTier = "team";
              if (priceId === process.env.STRIPE_PRICE_AGENCY)
                planTier = "agency";

              await admin
                .from("workspaces")
                .update({ plan_tier: planTier })
                .eq("id", workspaceId);
            }
            await entitlementDb.recordWebhookProcessed(event.id, workspaceId, event.type, event.data.object);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const workspaceId = subscription.metadata?.workspace_id;

          if (workspaceId && !(await entitlementDb.isWebhookProcessed(event.id, workspaceId))) {
            if (admin) {
              await admin
                .from("workspaces")
                .update({
                  plan_tier: "solo",
                  stripe_subscription_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", workspaceId);
            }
            await entitlementDb.recordWebhookProcessed(event.id, workspaceId, event.type, event.data.object);
          }
          break;
        }
      }

      res.json({ ok: true });
    })
  );

  // ──────────── /api/sequences
  app.post(
    "/api/sequences",
    requireAuth,
    validate({ body: createSequenceSimpleSchema }),
    asyncHandler(async (req, res) => {
      const { name, steps } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "admin");

      if (!admin) {
        return res.json({ ok: true, fallback: "no_db", sequence: null });
      }

      try {
        const { data, error } = await admin
          .from("sequences")
          .insert({
            workspace_id: workspaceId,
            name,
            steps,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        return res.json({ ok: true, sequence: data });
      } catch (err) {
        logEvent("error", "sequence_create_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "SEQUENCE_CREATE_FAILED", "Failed to create sequence", 502);
      }
    })
  );

  app.get(
    "/api/sequences",
    requireAuth,
    validate({ query: sequencesQuerySchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const workspaceId = await resolveWorkspaceId(req, user);

      if (!admin) {
        return res.json({ ok: true, sequences: [] });
      }

      try {
        const { data, error } = await admin
          .from("sequences")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return res.json({ ok: true, sequences: data || [] });
      } catch (err) {
        logEvent("error", "sequences_fetch_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "SEQUENCES_FETCH_FAILED", "Failed to fetch sequences", 502);
      }
    })
  );

  app.post(
    "/api/sequences/:id/enroll",
    requireAuth,
    validate({ params: commonSchemas.sequenceIdParam, body: enrollSequenceSchema }),
    asyncHandler(async (req, res) => {
      const { leadId } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };

      await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "admin");
      if (!admin) {
        return res.json({ ok: true, fallback: "no_db" });
      }

      try {
        // Get sequence details
        const { data: sequence, error: sequenceError } = await admin
          .from("sequences")
          .select("steps, workspace_id")
          .eq("id", id)
          .single();

        if (sequenceError || !sequence) {
          return unifiedNotFoundError(res, "Sequence");
        }

        await assertWorkspaceAccessWithContext(req, user, sequence.workspace_id);
        requireWorkspaceRole(req, "admin");
        const { data: leadRow, error: leadError } = await admin
          .from("leads")
          .select("workspace_id")
          .eq("id", leadId)
          .single();
        if (leadError || !leadRow) {
          return unifiedNotFoundError(res, "Lead");
        }
        if (leadRow.workspace_id !== sequence.workspace_id) {
          throw httpError(403, "Workspace access denied.");
        }

        // Calculate first step send time
        const firstStep = sequence.steps[0];
        const nextSendAt = new Date();
        nextSendAt.setDate(nextSendAt.getDate() + (firstStep?.delayDays || 0));

        // Create enrollment
        const { data: enrollment, error: enrollmentError } = await admin
          .from("sequence_enrollments")
          .insert({
            lead_id: leadId,
            sequence_id: id,
            workspace_id: sequence.workspace_id,
            current_step: 1,
            status: "active",
            next_send_at: nextSendAt.toISOString(),
          })
          .select()
          .single();

        if (enrollmentError) throw enrollmentError;

        return res.json({ ok: true, enrollment });
      } catch (err) {
        logEvent("error", "sequence_enroll_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "SEQUENCE_ENROLL_FAILED", "Failed to enroll lead in sequence", 502);
      }
    })
  );

  app.delete(
    "/api/sequences/:id/enrollments/:leadId",
    requireAuth,
    validate({ params: commonSchemas.enrollmentParams }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id, leadId } = req.params as { id: string; leadId: string };

      await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "admin");
      if (!admin) {
        return res.json({ ok: true, fallback: "no_db" });
      }

      try {
        const { data: enrollment, error: findError } = await admin
          .from("sequence_enrollments")
          .select("workspace_id")
          .eq("sequence_id", id)
          .eq("lead_id", leadId)
          .single();
        if (findError || !enrollment) {
          return unifiedNotFoundError(res, "Enrollment");
        }
        await assertWorkspaceAccessWithContext(req, user, enrollment.workspace_id);
        requireWorkspaceRole(req, "admin");
        const { error } = await admin
          .from("sequence_enrollments")
          .delete()
          .eq("sequence_id", id)
          .eq("lead_id", leadId)
          .eq("workspace_id", enrollment.workspace_id);

        if (error) throw error;

        return res.json({ ok: true });
      } catch (err) {
        logEvent("error", "sequence_unenroll_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "SEQUENCE_UNENROLL_FAILED", "Failed to remove lead from sequence", 502);
      }
    })
  );

  // ──────────── /api/ab-tests
  app.post(
    "/api/ab-tests",
    requireAuth,
    validate({ body: createABTestSchema }),
    asyncHandler(async (req, res) => {
      const { sequenceId, stepNumber, variants } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "admin");

      if (!admin) {
        return res.json({ ok: true, fallback: "no_db", abTestId: null });
      }

      try {
        const abTestId = await createABTest(
          workspaceId,
          sequenceId,
          stepNumber,
          variants
        );

        if (abTestId) {
          return res.json({ ok: true, abTestId });
        } else {
          return unifiedError(res, "AB_TEST_CREATE_FAILED", "Failed to create A/B test", 500);
        }
      } catch (err) {
        logEvent("error", "ab_test_create_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "AB_TEST_CREATE_FAILED", "Failed to create A/B test", 500);
      }
    })
  );

  app.get(
    "/api/ab-tests/:id/results",
    requireAuth,
    validate({ params: commonSchemas.abTestIdParam, query: abTestResultsQuerySchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };

      try {
        const workspaceId = await resolveWorkspaceId(req, user);
        requireWorkspaceRole(req, "admin");
        if (!admin) {
          return res.json({ ok: true, results: [], hasEnoughData: false });
        }
        const { data: abTestRow, error: abTestError } = await admin
          .from("ab_tests")
          .select("workspace_id")
          .eq("id", id)
          .single();
        if (abTestError || !abTestRow) {
          return unifiedNotFoundError(res, "A/B test");
        }
        if (abTestRow.workspace_id !== workspaceId) {
          throw httpError(403, "Workspace access denied.");
        }

        const results = await calculateABTestPerformance(id);

        // Check if we have enough data (min 50 sends total)
        const totalSends = results.reduce((sum, r) => sum + r.sends, 0);
        const hasEnoughData = totalSends >= 50;

        // Determine winner
        let winnerVariantId = null;
        if (hasEnoughData && results.length > 0) {
          const maxScore = Math.max(...results.map(r => r.intentScore));
          const secondBest = results
            .filter(r => r.intentScore < maxScore)
            .sort((a, b) => b.intentScore - a.intentScore)[0];

          const winner = results.find(r => r.intentScore === maxScore);
          if (
            winner &&
            (!secondBest || maxScore - secondBest.intentScore >= 5)
          ) {
            winnerVariantId = winner.variantId;
          }
        }

        return res.json({
          ok: true,
          results,
          hasEnoughData,
          winnerVariantId,
        });
      } catch (err) {
        logEvent("error", "ab_test_results_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "AB_TEST_RESULTS_FAILED", "Failed to get A/B test results", 500);
      }
    })
  );

  app.post(
    "/api/ab-tests/:id/promote",
    requireAuth,
    validate({ params: commonSchemas.abTestIdParam, body: promoteABTestSchema }),
    asyncHandler(async (req, res) => {
      const { winnerVariantId } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };

      try {
        const workspaceId = await resolveWorkspaceId(req, user);
        requireWorkspaceRole(req, "admin");
        if (!admin) {
          return res.json({ ok: true, fallback: "no_db" });
        }
        const { data: abTestRow, error: abTestError } = await admin
          .from("ab_tests")
          .select("workspace_id")
          .eq("id", id)
          .single();
        if (abTestError || !abTestRow) {
          return unifiedNotFoundError(res, "A/B test");
        }
        if (abTestRow.workspace_id !== workspaceId) {
          throw httpError(403, "Workspace access denied.");
        }

        await promoteWinner(id, winnerVariantId);

        return res.json({ ok: true });
      } catch (err) {
        logEvent("error", "ab_test_promote_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        return unifiedError(res, "AB_TEST_PROMOTE_FAILED", "Failed to promote winner", 500);
      }
    })
  );

  // ──────────── /api/leads/export
  app.get(
    "/api/leads/export",
    requireAuth,
    validate({ query: exportLeadsQuerySchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const {
        format = "csv",
        workspaceId,
        leadIds,
      } = req.query as {
        format?: string;
        workspaceId?: string;
        leadIds?: string;
      };

      const targetWorkspaceId = workspaceId
        ? workspaceId
        : await resolveWorkspaceId(req, user);
      if (workspaceId) {
        await assertWorkspaceAccessWithContext(req, user, targetWorkspaceId);
      }
      requireWorkspaceRole(req, "member");

      if (!entitlementDb.isConfigured) {
        return unifiedServiceUnavailable(res, "DATABASE_URL is required for entitlements.");
      }
      const workspaceTier = await getWorkspaceTier(targetWorkspaceId);
      const limits = TIER_LIMITS[workspaceTier];
      const usageMonth = getCurrentMonthKey();
      const consumed = await entitlementDb.consumeWorkspaceEntitlement({
        workspaceId: targetWorkspaceId,
        tier: workspaceTier,
        usageMonth,
        feature: "exports",
        limits,
      });
      if (!consumed.allowed) {
        return unifiedError(
          res,
          "MONTHLY_EXPORT_LIMIT_REACHED",
          "Monthly export limit reached. Upgrade plan or wait for next month.",
          403
        );
      }

      if (!admin) {
        return unifiedServiceUnavailable(res, "Export not available without database");
      }

      try {
        let content: string;
        let filename: string;
        let mimeType: string;

        switch (format) {
          case "csv":
            content = await generateCSVExport(targetWorkspaceId);
            filename = `skerry-leads-csv-${new Date().toISOString().split("T")[0]}.csv`;
            mimeType = "text/csv";
            break;

          case "hubspot":
            const hubspotData = await generateHubSpotExport(targetWorkspaceId);
            content = JSON.stringify(hubspotData, null, 2);
            filename = `skerry-leads-hubspot-${new Date().toISOString().split("T")[0]}.json`;
            mimeType = "application/json";
            break;

          case "salesforce":
            content = await generateSalesforceExport(targetWorkspaceId);
            filename = `skerry-leads-salesforce-${new Date().toISOString().split("T")[0]}.csv`;
            mimeType = "text/csv";
            break;

          default:
            return unifiedValidationError(res, "format (csv, hubspot, or salesforce)");
        }

        // Set headers for file download
        res.setHeader("Content-Type", mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.send(content);
      } catch (err) {
        logEvent("error", "leads_export_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          format,
          workspaceId: targetWorkspaceId,
          error: String(err),
        });

        const errorMessage =
          err instanceof Error ? err.message : "Export failed";
        return unifiedError(res, "LEADS_EXPORT_FAILED", errorMessage, 500);
      }
    })
  );

  // ──────────── /api/audit/logs
  app.get(
    "/api/audit/logs",
    requireAuth,
    validate({ query: auditLogsQuerySchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { limit = 50, action } = req.query as {
        limit?: string;
        action?: string;
      };

      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "admin");

      if (!admin) {
        return res.json({ ok: true, logs: [] });
      }

      try {
        const logs = await getAuditLogs(
          workspaceId,
          parseInt(String(limit || "50")) || 50,
          action
        );

        return res.json({ ok: true, logs });
      } catch (err) {
        logEvent("error", "audit_logs_fetch_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId,
          error: String(err),
        });
        return unifiedError(res, "AUDIT_LOGS_FETCH_FAILED", "Failed to fetch audit logs", 500);
      }
    })
  );

  app.get(
    "/api/audit/logs/export",
    requireAuth,
    validate({ query: auditLogsQuerySchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { format = "csv", action } = req.query as {
        format?: string;
        action?: string;
      };

      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "admin");

      if (!admin) {
        return unifiedServiceUnavailable(res, "Export not available without database");
      }

      try {
        const logs = await getAuditLogs(workspaceId, 1000, action);

        if (format === "csv") {
          // Generate CSV
          const headers = [
            "ID",
            "User ID",
            "Action",
            "Resource Type",
            "Resource ID",
            "Metadata",
            "Created At",
          ];
          const csvRows = logs.map(log => [
            log.id,
            log.user_id || "",
            log.action,
            log.resource_type || "",
            log.resource_id || "",
            JSON.stringify(log.metadata),
            log.created_at,
          ]);

          const csvContent = [
            headers.join(","),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(",")),
          ].join("\n");

          const filename = `skerry-audit-logs-${new Date().toISOString().split("T")[0]}.csv`;

          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
          res.send(csvContent);
        } else {
          // JSON format
          const filename = `skerry-audit-logs-${new Date().toISOString().split("T")[0]}.json`;

          res.setHeader("Content-Type", "application/json");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
          res.json({ logs, exportedAt: new Date().toISOString() });
        }
      } catch (err) {
        logEvent("error", "audit_logs_export_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId,
          format,
          error: String(err),
        });
        return unifiedError(res, "AUDIT_LOGS_EXPORT_FAILED", "Failed to export audit logs", 500);
      }
    })
  );

  // ──────────── /api/leads/:id/delete-request
  app.post(
    "/api/leads/:id/delete-request",
    requireAuth,
    validate({ params: commonSchemas.leadIdParam }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };
      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");

      if (!admin) {
        return unifiedServiceUnavailable(res, "GDPR features not available without database");
      }

      try {
        // Hole Lead-Email für Löschantrag
        const { data: lead, error: leadError } = await admin
          .from("leads")
          .select("email")
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .single();

        if (leadError || !lead) {
          return unifiedNotFoundError(res, "Lead");
        }

        const userEmail = lead.email;
        if (!userEmail) {
          return unifiedValidationError(res, "Lead has no email address");
        }

        // Prüfe ob bereits Löschantrag existiert
        const hasExisting = await hasDeletionRequest(userEmail);
        if (hasExisting) {
          return res.json({
            ok: true,
            message: "Deletion request already exists",
            status: "pending",
          });
        }

        // Erstelle Löschantrag
        const requestId = await createDeletionRequest({
          workspaceId,
          leadId: id,
          userEmail,
          requestSource: "user_request",
        });

        if (requestId) {
          // Audit Log
          await logAudit({
            workspaceId,
            userId: user.id,
            action: "lead.deletion_requested",
            resourceType: "lead",
            resourceId: id,
            metadata: {
              userEmail,
              requestId,
              deletionDeadline: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
            },
          });

          return res.json({
            ok: true,
            message:
              "Deletion request created. Data will be deleted within 30 days.",
            requestId,
            deletionDeadline: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          });
        } else {
          return unifiedError(res, "DELETION_REQUEST_FAILED", "Failed to create deletion request", 500);
        }
      } catch (err) {
        logEvent("error", "deletion_request_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          leadId: id,
          error: String(err),
        });
        return unifiedError(res, "DELETION_REQUEST_FAILED", "Failed to create deletion request", 500);
      }
    })
  );

  // ──────────── /api/workspaces/:id/data-export
  app.get(
    "/api/workspaces/:id/data-export",
    requireAuth,
    validate({ params: commonSchemas.workspaceIdParam }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };
      await assertWorkspaceAccessWithContext(req, user, id);
      requireWorkspaceRole(req, "owner");

      if (!admin) {
        return unifiedServiceUnavailable(res, "Export not available without database");
      }

      try {
        const data = await exportWorkspaceData(id);

        // Erstelle ZIP-File (vereinfacht - nur JSON)
        const filename = `skerry-workspace-data-${id}-${new Date().toISOString().split("T")[0]}.json`;

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.json(data);

        // Audit Log
        await logAudit({
          workspaceId: id,
          userId: user.id,
          action: "workspace.data_exported",
          resourceType: "workspace",
          resourceId: id,
          metadata: {
            exportDate: data.exportDate,
            leadsCount: data.leads.length,
            emailsCount: data.emails.length,
          },
        });
      } catch (err) {
        logEvent("error", "workspace_export_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId: id,
          error: String(err),
        });
        return unifiedError(
          res,
          "WORKSPACE_EXPORT_FAILED",
          "Failed to export workspace data",
          500
        );
      }
    })
  );

  // ──────────── /api/workspaces/:id/delete
  app.delete(
    "/api/workspaces/:id/delete",
    requireAuth,
    validate({ params: commonSchemas.workspaceIdParam, body: deleteWorkspaceSchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };

      await assertWorkspaceOwner(req, user, id);

      if (!admin) {
        return unifiedServiceUnavailable(res, "Delete not available without database");
      }

      try {
        // Audit Log vor Löschung
        await logAudit({
          workspaceId: id,
          userId: user.id,
          action: "workspace.deleted",
          resourceType: "workspace",
          resourceId: id,
          metadata: {
            deletedBy: user.email,
            deletedAt: new Date().toISOString(),
          },
        });

        await deleteWorkspace(id);

        return res.json({
          ok: true,
          message: "Workspace and all data deleted permanently",
        });
      } catch (err) {
        logEvent("error", "workspace_delete_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId: id,
          error: String(err),
        });
        return unifiedError(res, "WORKSPACE_DELETE_FAILED", "Failed to delete workspace", 500);
      }
    })
  );

  // ──────────── /api/workspaces/:id/brand (public endpoint)
  app.get(
    "/api/workspaces/:id/brand",
    validate({ params: commonSchemas.workspaceIdParam }),
    asyncHandler(async (req, res) => {
      const { id } = req.params as { id: string };

      if (!admin) {
        return res.json({
          ok: true,
          brand: {
            brand_name: "Skerry",
            brand_logo_url: "",
            brand_primary_color: "#06b6d4",
            custom_domain: "",
            from_email: "Skerry <onboarding@resend.dev>",
          },
        });
      }

      try {
        const { data, error } = await admin
          .from("workspaces")
          .select(
            "brand_name, brand_logo_url, brand_primary_color, custom_domain, from_email"
          )
          .eq("id", id)
          .single();

        if (error || !data) {
          return unifiedNotFoundError(res, "Workspace");
        }

        return res.json({
          ok: true,
          brand: {
            brand_name: data.brand_name || "Skerry",
            brand_logo_url: data.brand_logo_url || "",
            brand_primary_color: data.brand_primary_color || "#06b6d4",
            custom_domain: data.custom_domain || "",
            from_email: data.from_email || "Skerry <onboarding@resend.dev>",
          },
        });
      } catch (err) {
        logEvent("error", "brand_fetch_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId: id,
          error: String(err),
        });
        return unifiedError(res, "BRAND_FETCH_FAILED", "Failed to fetch brand settings", 500);
      }
    })
  );

  // ──────────── /api/workspaces/:id/brand (update endpoint)
  app.put(
    "/api/workspaces/:id/brand",
    requireAuth,
    validate({ params: commonSchemas.workspaceIdParam, body: updateBrandSchema }),
    asyncHandler(async (req, res) => {
      const { brandName, brandLogoUrl, brandPrimaryColor, customDomain, fromEmail } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const { id } = req.params as { id: string };

      await assertWorkspaceAccessWithContext(req, user, id);
      requireWorkspaceRole(req, "owner");

      if (!admin) {
        return res.json({ ok: true, fallback: "no_db" });
      }

      try {
        const { data, error } = await admin
          .from("workspaces")
          .update({
            brand_name: brandName,
            brand_logo_url: brandLogoUrl,
            brand_primary_color: brandPrimaryColor,
            custom_domain: customDomain,
            from_email: fromEmail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("brand_name, brand_logo_url, brand_primary_color, custom_domain, from_email")
          .single();

        if (error) throw error;

        return res.json({
          ok: true,
          brand: {
            brand_name: data.brand_name,
            brand_logo_url: data.brand_logo_url,
            brand_primary_color: data.brand_primary_color,
            custom_domain: data.custom_domain,
            from_email: data.from_email,
          },
        });
      } catch (err) {
        logEvent("error", "brand_update_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId: id,
          error: String(err),
        });
        return unifiedError(res, "BRAND_UPDATE_FAILED", "Failed to update brand settings", 500);
      }
    })
  );

  // ──────────── /api/gdpr/deletion-request
  app.post(
    "/api/gdpr/deletion-request",
    requireAuth,
    validate({ body: gdprDeletionRequestSchema }),
    asyncHandler(async (req, res) => {
      const { leadId, requestSource } = (req as any).body;
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");

      if (!admin) {
        return res.json({ ok: true, fallback: "no_db" });
      }

      try {
        const requestId = await createDeletionRequest({
          workspaceId,
          leadId,
          userEmail: user.email,
          requestSource: requestSource ?? "user_request",
        });

        return res.json({
          ok: true,
          requestId,
          message: "Deletion request created. Data will be deleted within 30 days.",
        });
      } catch (err) {
        logEvent("error", "gdpr_deletion_request_api_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId,
          leadId,
          error: String(err),
        });
        return unifiedError(res, "GDPR_DELETION_REQUEST_FAILED", "Failed to create deletion request", 500);
      }
    })
  );

  // ──────────── /api/gdpr/data-export
  app.get(
    "/api/gdpr/data-export",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }

      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");

      if (!admin) {
        return unifiedServiceUnavailable(res, "GDPR features not available without database");
      }

      try {
        const data = await exportWorkspaceData(workspaceId);

        // Set headers for file download
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="skerry-gdpr-export-${workspaceId}-${new Date().toISOString().split("T")[0]}.json"`
        );
        res.send(JSON.stringify(data, null, 2));
      } catch (err) {
        logEvent("error", "gdpr_data_export_api_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          workspaceId,
          userId: user.id,
          error: String(err),
        });
        return unifiedError(res, "GDPR_DATA_EXPORT_FAILED", "Failed to export data", 500);
      }
    })
  );

  // ──────────── /api/webhooks/resend
  app.post(
    "/api/webhooks/resend",
    validate({ body: resendWebhookSchema }),
    asyncHandler(async (req, res) => {
      const { events } = (req as any).body;
      const signature = req.headers["resend-signature"] as string;
      const secret = process.env.RESEND_WEBHOOK_SECRET;

      if (!secret || !signature) {
        return unifiedError(res, "MISSING_SIGNATURE_OR_SECRET", "Missing signature or secret", 401);
      }

      const payload = JSON.stringify(req.body);
      if (!validateResendWebhook(payload, signature, secret)) {
        return unifiedError(res, "INVALID_SIGNATURE", "Invalid signature", 401);
      }

      const result = await handleResendWebhook(events);

      logEvent("info", "resend_webhook_processed", {
        totalEvents: events.length,
        processed: result.processed,
        errors: result.errors,
      });

      return res.json({
        ok: true,
        processed: result.processed,
        errors: result.errors,
      });
    })
  );

  // ──────────── /api/email/verify
  app.post(
    "/api/email/verify",
    requireAuth,
    validate({ body: verifyEmailSchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }
      await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");
      const { email } = (req as any).body as VerifyEmailBody;
      const neverbounceKey = process.env.NEVERBOUNCE_API_KEY;
      if (!neverbounceKey) {
        return res.json({ ok: true, valid: true, status: "format_only" });
      }
      try {
        const url = `https://api.neverbounce.com/v4/single/check?key=${encodeURIComponent(neverbounceKey)}&email=${encodeURIComponent(email)}`;
        const resp = await fetchWithTimeoutRetry(
          url,
          { method: "GET" },
          {
            timeoutMs: PROVIDER_TIMEOUT_MS,
            retries: PROVIDER_RETRIES,
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
            provider: "neverbounce",
          }
        );
        const json = (await resp.json()) as {
          result?: string;
          status?: string;
          message?: string;
        };
        const result = json.result ?? json.status ?? "unknown";
        const verified = result === "valid" || result === "catchall";
        // NeverBounce returns "general_failure" with a message when credits run out
        // or the account is misconfigured. Don't block the send — fall back to format-only.
        if (result === "general_failure") {
          return res.json({
            ok: true,
            valid: true,
            status: "format_only",
            warning: json.message ?? "neverbounce general_failure",
          });
        }
        return res.json({ ok: true, valid: verified, status: result });
      } catch (err) {
        return res.json({
          ok: true,
          valid: true,
          status: "format_only",
          warning: clientSafeWarning(err),
        });
      }
    })
  );

  // ──────────── /api/email/send (Resend; falls back to dry-run if no key)
  app.post(
    "/api/email/send",
    requireAuth,
    validate({ body: sendEmailSchema }),
    asyncHandler(async (req, res) => {
      const user = getSessionUser(req);
      if (!user) {
        return unifiedAuthError(res);
      }
      const workspaceId = await resolveWorkspaceId(req, user);
      requireWorkspaceRole(req, "member");
      const { to, subject, bodyMarkdown } = (req as any).body as SendEmailBody;
      const resendKey = process.env.RESEND_API_KEY;
      const from =
        process.env.SKERRY_FROM_EMAIL ?? "Skerry <onboarding@resend.dev>";
      const { subject: parsedSubject, body } =
        extractSubjectAndBody(bodyMarkdown);
      const finalSubject = subject || parsedSubject;
      const toDomain = to.includes("@") ? to.split("@").slice(-1)[0] : "";

      if (!resendKey) {
        logEvent("info", "email_send_dry_run", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          toDomain,
        });
        return res.json({ ok: true, dryRun: true, id: `dryrun_${Date.now()}` });
      }

      try {
        const resp = await fetchWithTimeoutRetry(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to,
              subject: finalSubject,
              html: mdToHtml(body),
              text: mdToText(body),
            }),
          },
          {
            timeoutMs: PROVIDER_TIMEOUT_MS,
            retries: PROVIDER_RETRIES,
            requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
            provider: "resend",
          }
        );
        const json = (await resp.json()) as { id?: string; message?: string };
        if (!resp.ok) {
          return unifiedError(res, "EMAIL_SEND_FAILED", json.message ?? "send failed", 502);
        }
        await logAudit({
          workspaceId,
          userId: user.id,
          action: "email.sent",
          resourceType: "email",
          metadata: {
            toDomain,
            messageId: json.id,
          },
        });
        return res.json({ ok: true, id: json.id });
      } catch (err) {
        logEvent("error", "email_send_failed", {
          requestId: (req as RequestWithContext).ctx?.requestId ?? "unknown",
          error: String(err),
        });
        await logAudit({
          workspaceId,
          userId: user.id,
          action: "email.failed",
          resourceType: "email",
          metadata: {
            toDomain,
          },
        });
        return unifiedError(res, "EMAIL_SEND_FAILED", clientSafeError(err), 502);
      }
    })
  );

  // Static SPA in production. In dev, Vite serves the SPA on its own port.
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");
  const indexPath = path.join(staticPath, "index.html");
  app.use(express.static(staticPath));
  app.get("*", (req, res, next) => {
    if (process.env.NODE_ENV !== "production" && !fs.existsSync(indexPath)) {
      return res.redirect(302, `http://localhost:3000${req.originalUrl}`);
    }
    res.sendFile(indexPath, err => {
      if (err) next(err);
    });
  });

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const requestId =
        (req as RequestWithContext).ctx?.requestId ??
        req.get("x-request-id") ??
        makeRequestId();
      const withStatus = err as { status?: number; statusCode?: number };
      const fromStatus =
        typeof withStatus.status === "number"
          ? withStatus.status
          : typeof withStatus.statusCode === "number"
            ? withStatus.statusCode
            : undefined;
      const status =
        fromStatus !== undefined && fromStatus >= 400 && fromStatus < 600
          ? fromStatus
          : err instanceof SyntaxError
            ? 400
            : 500;
      if (status >= 500) {
        logEvent("error", "unhandled_route_error", {
          requestId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        // Capture exception in Sentry with full context
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
          tags: { requestId },
          extra: { path: req.path, method: req.method },
        });
      }
      if (!res.headersSent) {
        const exposeDetail = process.env.NODE_ENV !== "production";
        const message =
          status === 400
            ? "Invalid request body."
            : exposeDetail && err instanceof Error
              ? err.message
              : exposeDetail
                ? String(err)
                : "Internal server error.";
        res.status(status).json({ ok: false, code: "INTERNAL_ERROR", message, requestId });
      }
    }
  );

  return app;
}

async function startServer() {
  const app = await buildApp();
  const server = createServer(app);
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, () => {
    logEvent("info", "server_started", {
      port,
      url: `http://localhost:${port}/`,
      health: `http://localhost:${port}/api/health`,
      ready: `http://localhost:${port}/api/ready`,
    });
  });
}

const isEntrypoint = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;
if (isEntrypoint) {
  startServer().catch(err => {
    logEvent("error", "server_start_failed", {
      requestId: makeRequestId(),
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
