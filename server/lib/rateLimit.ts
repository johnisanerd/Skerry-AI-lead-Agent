/**
 * Enterprise-grade rate limiting middleware for Skerry.
 * 
 * Replaces IP-based in-memory rate limiting with:
 * - PostgreSQL-backed distributed store
 * - Workspace/user/API key scoping
 * - Tier-based limits (solo/team/agency)
 * - Different limiters for different endpoints (auth, LLM, API, global)
 * 
 * Security improvements over basic rate limiting:
 * - Attackers with multiple IPs can't bypass limits (scoped to workspace/user)
 * - Works across multiple server instances (distributed store)
 * - Survives server restarts (persistent storage)
 * - Respects account tiers (agency gets higher limits)
 */

import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { PostgresRateLimitStore, makeRateLimitKey } from "./rateLimitStore.js";
import type { Pool } from "pg";

export type AccountTier = "solo" | "team" | "agency";

/**
 * Rate limit tiers with different limits for different account types.
 * Agency customers get higher limits as they pay more.
 */
export interface TierLimits {
  /** Global requests per minute */
  global: number;
  /** Login attempts per 15 minutes */
  auth: number;
  /** LLM/AI requests per minute */
  llm: number;
  /** API requests per minute (for programmatic access) */
  api: number;
  /** Lead generation requests per hour */
  leads: number;
}

const TIER_LIMITS: Record<AccountTier, TierLimits> = {
  solo: {
    global: 120,    // 2 req/sec
    auth: 5,        // 5 attempts per 15 min
    llm: 20,        // 20 AI requests per minute
    api: 60,        // 1 req/sec for API
    leads: 30,      // 30 lead gen per hour
  },
  team: {
    global: 300,    // 5 req/sec
    auth: 10,       // 10 attempts per 15 min
    llm: 60,        // 60 AI requests per minute
    api: 300,       // 5 req/sec for API
    leads: 100,     // 100 lead gen per hour
  },
  agency: {
    global: 1000,   // ~16 req/sec
    auth: 20,       // 20 attempts per 15 min
    llm: 200,       // 200 AI requests per minute
    api: 1000,      // ~16 req/sec for API
    leads: 500,     // 500 lead gen per hour
  },
};

/**
 * Get the account tier for a request.
 * Extracts workspace_id from request and looks up the tier.
 * Falls back to 'solo' if not found.
 */
async function getAccountTier(
  req: Request,
  pool: Pool
): Promise<AccountTier> {
  // Try to get workspace_id from header, body, or query
  const workspaceId = 
    (req.get("x-workspace-id") as string | undefined) ||
    (req.body as Record<string, unknown>)?.workspaceId as string | undefined ||
    (req.query as Record<string, unknown>)?.workspaceId as string | undefined;

  if (!workspaceId) return "solo";

  try {
    const result = await pool.query<{ tier: string }>(
      `SELECT tier FROM workspace_entitlements 
       WHERE workspace_id = $1 
       ORDER BY usage_month DESC 
       LIMIT 1`,
      [workspaceId]
    );
    
    if (result.rows.length > 0) {
      const tier = result.rows[0].tier;
      if (tier === "team" || tier === "agency") return tier;
    }
  } catch {
    // If query fails, fall back to solo
  }

  return "solo";
}

/**
 * Extract user ID from request (from JWT/session).
 */
function getUserId(req: Request): string | null {
  // Check if user is attached by auth middleware
  const user = (req as unknown as Record<string, unknown>).user as
    | { id: string; email: string }
    | undefined;
  return user?.id ?? null;
}

/**
 * Extract API key from request.
 */
function getApiKey(req: Request): string | null {
  const authHeader = req.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Create the key generator for rate limiting.
 * Uses workspace > user > API key > IP fallback.
 */
function createKeyGenerator(
  pool: Pool,
  windowType: string
) {
  return async (req: Request): Promise<string> => {
    // Priority 1: Workspace ID (most specific, best for multi-user orgs)
    const workspaceId = 
      (req.get("x-workspace-id") as string | undefined) ||
      (req.body as Record<string, unknown>)?.workspaceId as string | undefined ||
      (req.query as Record<string, unknown>)?.workspaceId as string | undefined;
    
    if (workspaceId) {
      return makeRateLimitKey("workspace", workspaceId, windowType);
    }

    // Priority 2: User ID (from auth middleware)
    const userId = getUserId(req);
    if (userId) {
      return makeRateLimitKey("user", userId, windowType);
    }

    // Priority 3: API Key (for programmatic access)
    const apiKey = getApiKey(req);
    if (apiKey) {
      // Hash the API key to avoid storing it in plain text in the rate limit table
      const crypto = await import("node:crypto");
      const hashedKey = crypto
        .createHash("sha256")
        .update(apiKey)
        .digest("hex")
        .slice(0, 16); // Use first 16 chars for key
      return makeRateLimitKey("apikey", hashedKey, windowType);
    }

    // Priority 4: IP address (fallback, least secure)
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    return makeRateLimitKey("ip", ip, windowType);
  };
}

/**
 * Create a rate limiter with enterprise features.
 */
export function createEnterpriseRateLimiter(
  pool: Pool,
  options: {
    /** Type of rate limiter */
    type: "global" | "auth" | "llm" | "api" | "leads";
    /** Window size in milliseconds */
    windowMs: number;
    /** Custom max requests (overrides tier-based) */
    max?: number | ((tier: AccountTier, req: Request) => number);
    /** Prefix for the store */
    prefix?: string;
    /** Custom key generator */
    keyGenerator?: (req: Request) => Promise<string> | string;
    /** Skip rate limiting for certain requests */
    skip?: (req: Request) => boolean | Promise<boolean>;
  }
) {
  const store = new PostgresRateLimitStore({
    pool,
    tableName: "rate_limit_buckets",
    keyPrefix: options.prefix ?? options.type,
    cleanupIntervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
  });

  const windowType = options.type;

  return rateLimit({
    windowMs: options.windowMs,
    max: async (req: Request) => {
      // Get the account tier
      const tier = await getAccountTier(req, pool);
      
      // If custom max function provided, use it
      if (typeof options.max === "function") {
        return options.max(tier, req);
      }
      
      // If custom max number provided, use it
      if (typeof options.max === "number") {
        return options.max;
      }
      
      // Otherwise use tier-based limits
      return TIER_LIMITS[tier][options.type];
    },
    keyGenerator: async (req: Request): Promise<string> => {
      if (options.keyGenerator) {
        return options.keyGenerator(req);
      }
      const generator = createKeyGenerator(pool, windowType);
      return generator(req);
    },
    skip: options.skip,
    store,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please retry shortly.",
    },
    // Add request ID to response for tracing
    requestWasSuccessful: (req: Request, res: Response) => {
      return res.statusCode < 400;
    },
  });
}

/**
 * Pre-configured enterprise rate limiters.
 */
export function createEnterpriseLimiters(pool: Pool) {
  return {
    /** Global rate limiter - applies to all requests */
    global: createEnterpriseRateLimiter(pool, {
      type: "global",
      windowMs: 60 * 1000, // 1 minute
    }),

    /** Auth rate limiter - for login/register endpoints */
    auth: createEnterpriseRateLimiter(pool, {
      type: "auth",
      windowMs: 15 * 60 * 1000, // 15 minutes
    }),

    /** LLM rate limiter - for AI/OpenAI endpoints */
    llm: createEnterpriseRateLimiter(pool, {
      type: "llm",
      windowMs: 60 * 1000, // 1 minute
    }),

    /** API rate limiter - for programmatic API access */
    api: createEnterpriseRateLimiter(pool, {
      type: "api",
      windowMs: 60 * 1000, // 1 minute
    }),

    /** Leads rate limiter - for lead generation endpoints */
    leads: createEnterpriseRateLimiter(pool, {
      type: "leads",
      windowMs: 60 * 60 * 1000, // 1 hour
    }),
  };
}

/**
 * Get tier limits (for display in UI or documentation).
 */
export function getTierLimits(tier: AccountTier): TierLimits {
  return { ...TIER_LIMITS[tier] };
}

/**
 * Get all tier limits (for admin/settings UI).
 */
export function getAllTierLimits(): Record<AccountTier, TierLimits> {
  return {
    solo: { ...TIER_LIMITS.solo },
    team: { ...TIER_LIMITS.team },
    agency: { ...TIER_LIMITS.agency },
  };
}
