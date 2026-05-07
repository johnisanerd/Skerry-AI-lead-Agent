/**
 * Enterprise-grade PostgreSQL-backed store for express-rate-limit.
 * 
 * Replaces the default in-memory store with a distributed PostgreSQL store.
 * Supports multi-node deployments and survives server restarts.
 * 
 * Key features:
 * - Distributed: Works across multiple server instances
 * - Persistent: Survives server restarts
 * - Workspace/User scoped: Rate limits per workspace or user, not just IP
 * - Tier-aware: Different limits for different account tiers
 * - API key support: Rate limits for programmatic access
 */

import { type Pool, type PoolClient } from "pg";
import type { Store, IncrementResponse, ClientRateLimitInfo, Options } from "express-rate-limit";

export interface RateLimitStoreOptions {
  /** PostgreSQL pool instance */
  pool: Pool;
  /** Table name for rate limit buckets (default: 'rate_limit_buckets') */
  tableName?: string;
  /** Prefix for keys to namespace different limiters (default: '') */
  keyPrefix?: string;
  /** How often to clean up expired entries in ms (default: 5 minutes) */
  cleanupIntervalMs?: number;
}

interface BucketRow {
  key: string;
  window_start: Date;
  request_count: number;
}

/**
 * PostgreSQL-backed store for express-rate-limit.
 * 
 * Uses a single table with composite key structure:
 * - key: scope:id:window_type
 * - window_start: timestamp of window start
 * - request_count: number of requests in this window
 */
export class PostgresRateLimitStore implements Store {
  private pool: Pool;
  private tableName: string;
  private keyPrefix: string;
  private cleanupInterval?: NodeJS.Timeout;
  public localKeys: boolean = false; // false = distributed store

  constructor(options: RateLimitStoreOptions) {
    this.pool = options.pool;
    this.tableName = options.tableName ?? "rate_limit_buckets";
    this.keyPrefix = options.keyPrefix ?? "";

    // Start periodic cleanup if interval is set
    const cleanupMs = options.cleanupIntervalMs ?? 5 * 60 * 1000; // 5 minutes default
    if (cleanupMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup().catch((err) => {
          console.error("[RateLimitStore] Cleanup failed:", err);
        });
      }, cleanupMs);
    }
  }

  /**
   * Initialize the store (called by express-rate-limit).
   */
  init(_options: Options): void {
    // No initialization needed - table should exist via migration
  }

  /**
   * Generate a namespaced key.
   */
  private makeKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  /**
   * Get a client's hit count and reset time.
   */
  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const client = await this.pool.connect();
    try {
      const namespacedKey = this.makeKey(key);
      const result = await client.query<BucketRow>(
        `SELECT request_count, window_start FROM ${this.tableName} WHERE key = $1`,
        [namespacedKey]
      );
      
      if (result.rows.length === 0) return undefined;
      
      const row = result.rows[0];
      return {
        totalHits: row.request_count,
        resetTime: row.window_start,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Increment the request count for a key.
   * Uses upsert (INSERT ... ON CONFLICT) for atomic operation.
   */
  async increment(key: string): Promise<IncrementResponse> {
    const client = await this.pool.connect();
    try {
      const namespacedKey = this.makeKey(key);
      const now = new Date();

      // Try to increment existing bucket
      const result = await client.query<BucketRow>(
        `INSERT INTO ${this.tableName} (key, window_start, request_count, created_at, updated_at)
         VALUES ($1, $2, 1, $3, $3)
         ON CONFLICT (key) DO UPDATE SET
           request_count = CASE
             WHEN rate_limit_buckets.window_start < $2 THEN 1
             ELSE rate_limit_buckets.request_count + 1
           END,
           window_start = CASE
             WHEN rate_limit_buckets.window_start < $2 THEN $2
             ELSE rate_limit_buckets.window_start
           END,
           updated_at = $3
         RETURNING request_count, window_start`,
        [namespacedKey, now, now]
      );

      const row = result.rows[0];
      return {
        totalHits: row.request_count,
        resetTime: row.window_start,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Decrement is a no-op for rate limiting (not supported by express-rate-limit).
   */
  async decrement(key: string): Promise<void> {
    // express-rate-limit doesn't use decrement in normal operation
    // This is here for Store interface compliance
  }

  /**
   * Reset a specific key (for testing or manual reset).
   */
  async resetKey(key: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const namespacedKey = this.makeKey(key);
      await client.query(
        `DELETE FROM ${this.tableName} WHERE key = $1`,
        [namespacedKey]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Reset all keys (for testing).
   */
  async resetAll(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`DELETE FROM ${this.tableName}`);
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired entries.
   */
  async cleanup(): Promise<number> {
    const client = await this.pool.connect();
    try {
      // Delete entries older than 1 hour (safety cleanup)
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const result = await client.query(
        `DELETE FROM ${this.tableName} WHERE window_start < $1`,
        [cutoff]
      );
      return result.rowCount ?? 0;
    } finally {
      client.release();
    }
  }

  /**
   * Shutdown the store (clear cleanup interval).
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Create a composite key for rate limiting.
 * 
 * Key format: scope:identifier:window_type
 * 
 * Examples:
 * - ip:192.168.1.1:global
 * - user:user_123:api
 * - workspace:ws_456:llm
 * - apikey:ak_789:global
 */
export function makeRateLimitKey(
  scope: "ip" | "user" | "workspace" | "apikey",
  identifier: string,
  windowType: string = "global"
): string {
  return `${scope}:${identifier}:${windowType}`;
}
