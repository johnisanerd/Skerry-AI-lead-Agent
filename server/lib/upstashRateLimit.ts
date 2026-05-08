/**
 * Upstash-based rate limiting with sliding window algorithm.
 * 
 * Replaces the IP-based in-memory rate limiting with:
 * - Workspace-level rate limiting: rl:workspace:{workspaceId}:{endpoint}
 * - User-level rate limiting for auth endpoints (Login 5/15min, Password-Reset 3/h)
 * - Sliding window algorithm for more accurate rate limiting
 * - Fallback to in-memory if UPSTASH_REDIS_URL is not set
 * 
 * Features:
 * - Distributed rate limiting across multiple server instances
 * - Persistent rate limit data (survives server restarts)
 * - Proper 429 responses with Retry-After header
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Request, Response, NextFunction } from "express";
import { ErrorCode, createError } from "../../shared/errors.js";

/**
 * In-memory fallback store for when Upstash Redis is not configured.
 * Uses a simple Map with sliding window algorithm.
 */
class InMemorySlidingWindow {
  private requests: Map<string, number[]> = new Map();

  /**
   * Check if a request is allowed under the rate limit.
   * @param key - The rate limit key
   * @param maxRequests - Maximum requests allowed in the window
   * @param windowMs - Window size in milliseconds
   * @returns Object with allowed status and retry information
   */
  async limit(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetIn: number; // milliseconds until reset
  }> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this key
    let timestamps = this.requests.get(key) || [];

    // Filter out requests outside the window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if under limit
    if (timestamps.length < maxRequests) {
      timestamps.push(now);
      this.requests.set(key, timestamps);
      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - timestamps.length,
        resetIn: windowMs,
      };
    }

    // Over limit - calculate when the oldest request will expire
    const oldestInWindow = timestamps[0];
    const resetIn = oldestInWindow + windowMs - now;

    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetIn: Math.max(0, resetIn),
    };
  }

  /**
   * Reset a specific key (for testing).
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Reset all keys (for testing).
   */
  resetAll(): void {
    this.requests.clear();
  }
}

// Global in-memory store instance
const inMemoryStore = new InMemorySlidingWindow();

/**
 * Rate limit configuration for different endpoint types.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  max: number;
  /** Window size in seconds */
  window: number;
  /** Human-readable description */
  description: string;
}

/**
 * Predefined rate limit configurations.
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints
  "auth:login": {
    max: 5,
    window: 15 * 60, // 15 minutes
    description: "5 login attempts per 15 minutes",
  },
  "auth:password-reset": {
    max: 3,
    window: 60 * 60, // 1 hour
    description: "3 password reset attempts per hour",
  },
  "auth:register": {
    max: 3,
    window: 60 * 60, // 1 hour
    description: "3 registration attempts per hour",
  },

  // Workspace-level endpoints
  "workspace:global": {
    max: 120,
    window: 60, // 1 minute
    description: "120 requests per minute",
  },
  "workspace:llm": {
    max: 20,
    window: 60, // 1 minute
    description: "20 LLM requests per minute",
  },
  "workspace:leads": {
    max: 30,
    window: 60 * 60, // 1 hour
    description: "30 lead generation requests per hour",
  },
  "workspace:api": {
    max: 60,
    window: 60, // 1 minute
    description: "60 API requests per minute",
  },
};

/**
 * Create Upstash Redis client (if configured) or use in-memory fallback.
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      "[RateLimit] UPSTASH_REDIS_URL/UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_TOKEN/UPSTASH_REDIS_REST_TOKEN not set. " +
      "Using in-memory fallback (not suitable for multi-instance deployments)."
    );
    return null;
  }

  return new Redis({
    url,
    token,
  });
}

/**
 * Create a rate limiter instance for Upstash or in-memory fallback.
 */
function createRateLimiter(
  config: RateLimitConfig
): {
  limit: (key: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetIn: number;
  }>;
  reset: (key: string) => void | Promise<void>;
} {
  const redis = createRedisClient();

  if (redis) {
    // Use Upstash Ratelimit with sliding window
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.max, `${config.window}s`),
      prefix: "rl",
      analytics: true,
    });

    return {
      limit: async (key: string) => {
        const result = await ratelimit.limit(key);
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          resetIn: result.reset, // Already in milliseconds from Upstash
        };
      },
      reset: async (key: string) => {
        // Upstash Ratelimit doesn't expose a direct reset method
        // We need to use the underlying redis client
        if (redis) {
          const keys = await redis.keys(`rl:${key}*`);
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        }
      },
    };
  }

  // Fallback to in-memory
  return {
    limit: async (key: string) => {
      return inMemoryStore.limit(key, config.max, config.window * 1000);
    },
    reset: (key: string) => {
      inMemoryStore.reset(key);
    },
  };
}

/**
 * Extract workspace ID from request.
 */
function getWorkspaceId(req: Request): string | null {
  return (
    (req.get("x-workspace-id") as string | undefined) ||
    (req.body as Record<string, unknown>)?.workspaceId as string | undefined ||
    (req.query as Record<string, unknown>)?.workspaceId as string | undefined ||
    null
  );
}

/**
 * Extract user ID from request (from JWT/session).
 */
function getUserId(req: Request): string | null {
  const user = (req as unknown as Record<string, unknown>).user as
    | { id: string; email: string }
    | undefined;
  return user?.id ?? null;
}

/**
 * Create workspace-level rate limiter middleware.
 * Key format: rl:workspace:{workspaceId}:{endpoint}
 */
export function workspaceRateLimit(endpoint: string, customConfig?: Partial<RateLimitConfig>) {
  const config = {
    ...RATE_LIMITS[`workspace:${endpoint}`] || RATE_LIMITS["workspace:global"],
    ...customConfig,
  };
  const limiter = createRateLimiter(config);

  return async (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = getWorkspaceId(req);

    if (!workspaceId) {
      // No workspace ID - skip rate limiting or use IP fallback
      return next();
    }

    const key = `workspace:${workspaceId}:${endpoint}`;
    const result = await limiter.limit(key);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", config.max.toString());
    res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
    res.setHeader("X-RateLimit-Reset", (Date.now() + result.resetIn).toString());

    if (!result.success) {
      const retryAfter = Math.ceil(result.resetIn / 1000);
      res.setHeader("Retry-After", retryAfter.toString());

      return res.status(429).json(
        createError(
          ErrorCode.RATE_LIMITED,
          `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
          (req as unknown as Record<string, unknown>).requestId as string | undefined
        )
      );
    }

    next();
  };
}

/**
 * Create auth-level rate limiter middleware.
 * Key format: rl:user:{userId}:{endpoint} or rl:ip:{ip}:{endpoint}
 */
export function authRateLimit(
  endpoint: "login" | "password-reset" | "register",
  customConfig?: Partial<RateLimitConfig>
) {
  const configKey = `auth:${endpoint}`;
  const config = {
    ...RATE_LIMITS[configKey],
    ...customConfig,
  };
  const limiter = createRateLimiter(config);

  return async (req: Request, res: Response, next: NextFunction) => {
    // Try to get user ID first, fall back to IP
    const userId = getUserId(req);
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;
    const key = `${identifier}:${endpoint}`;

    const result = await limiter.limit(key);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", config.max.toString());
    res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
    res.setHeader("X-RateLimit-Reset", (Date.now() + result.resetIn).toString());

    if (!result.success) {
      const retryAfter = Math.ceil(result.resetIn / 1000);
      res.setHeader("Retry-After", retryAfter.toString());

      return res.status(429).json(
        createError(
          ErrorCode.RATE_LIMITED,
          `Too many ${endpoint} attempts. Please retry after ${retryAfter} seconds.`,
          (req as unknown as Record<string, unknown>).requestId as string | undefined
        )
      );
    }

    next();
  };
}

/**
 * Generic rate limit middleware factory.
 * Can be used for custom endpoints with specific configurations.
 */
export function createRateLimitMiddleware(
  keyGenerator: (req: Request) => string,
  config: RateLimitConfig
) {
  const limiter = createRateLimiter(config);

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const result = await limiter.limit(key);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", config.max.toString());
    res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
    res.setHeader("X-RateLimit-Reset", (Date.now() + result.resetIn).toString());

    if (!result.success) {
      const retryAfter = Math.ceil(result.resetIn / 1000);
      res.setHeader("Retry-After", retryAfter.toString());

      return res.status(429).json(
        createError(
          ErrorCode.RATE_LIMITED,
          `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
          (req as unknown as Record<string, unknown>).requestId as string | undefined
        )
      );
    }

    next();
  };
}

/**
 * Reset rate limit for a specific key (useful for testing or manual reset).
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = createRedisClient();

  if (redis) {
    // Delete keys matching the pattern
    const keys = await redis.keys(`rl:${key}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } else {
    inMemoryStore.reset(key);
  }
}

/**
 * Check if Upstash Redis is configured.
 */
export function isUpstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL);
}
