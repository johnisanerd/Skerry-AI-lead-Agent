/**
 * Integration tests for enterprise rate limiting.
 *
 * Tests the PostgreSQL-backed distributed rate limiting with:
 * - Workspace/user/API key scoping
 * - Tier-based limits
 * - Distributed store functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { PostgresRateLimitStore, makeRateLimitKey } from "./lib/rateLimitStore.js";
import { createEnterpriseLimiters, getTierLimits } from "./lib/rateLimit.js";

describe("Enterprise Rate Limiting", () => {
  let pool: Pool;
  let store: PostgresRateLimitStore;
  type AccountTier = "solo" | "team" | "agency";

  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL required for rate limit tests");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Clean up rate limit buckets before each test
    if (pool) {
      await pool.query("DELETE FROM rate_limit_buckets");
    }
  });

  describe("PostgresRateLimitStore", () => {
    beforeEach(() => {
      store = new PostgresRateLimitStore({
        pool,
        tableName: "rate_limit_buckets",
        keyPrefix: "test",
        cleanupIntervalMs: 0, // Disable cleanup for tests
      });
    });

    it("should increment and track request counts", async () => {
      const key = "ip:127.0.0.1:global";
      
      // First increment
      const result1 = await store.increment(key);
      expect(result1.totalHits).toBe(1);
      expect(result1.resetTime).toBeInstanceOf(Date);

      // Second increment
      const result2 = await store.increment(key);
      expect(result2.totalHits).toBe(2);
    });

    it("should get current count for a key", async () => {
      const key = "user:test-user-123:api";
      
      await store.increment(key);
      await store.increment(key);
      
      const info = await store.get(key);
      expect(info).toBeDefined();
      expect(info?.totalHits).toBe(2);
    });

    it("should reset a specific key", async () => {
      const key = "workspace:ws-456:llm";
      
      await store.increment(key);
      await store.increment(key);
      await store.increment(key);
      
      await store.resetKey(key);
      
      const info = await store.get(key);
      expect(info).toBeUndefined();
    });

    it("should reset all keys", async () => {
      await store.increment("key1");
      await store.increment("key2");
      await store.increment("key3");
      
      await store.resetAll();
      
      const result = await pool.query("SELECT COUNT(*) as count FROM rate_limit_buckets");
      expect(Number(result.rows[0].count)).toBe(0);
    });

    it("should handle namespaced keys with prefix", async () => {
      const storeWithPrefix = new PostgresRateLimitStore({
        pool,
        tableName: "rate_limit_buckets",
        keyPrefix: "myapp",
        cleanupIntervalMs: 0,
      });

      await storeWithPrefix.increment("user:123:global");
      
      // Should find the key with prefix
      const info = await storeWithPrefix.get("user:123:global");
      expect(info?.totalHits).toBe(1);
      
      // Should not find without prefix
      const infoNoPrefix = await store.get("user:123:global");
      expect(infoNoPrefix).toBeUndefined();
    });
  });

  describe("makeRateLimitKey", () => {
    it("should create correct key format for IP", () => {
      const key = makeRateLimitKey("ip", "192.168.1.1", "global");
      expect(key).toBe("ip:192.168.1.1:global");
    });

    it("should create correct key format for user", () => {
      const key = makeRateLimitKey("user", "user-123", "api");
      expect(key).toBe("user:user-123:api");
    });

    it("should create correct key format for workspace", () => {
      const key = makeRateLimitKey("workspace", "ws-456", "llm");
      expect(key).toBe("workspace:ws-456:llm");
    });

    it("should create correct key format for API key", () => {
      const key = makeRateLimitKey("apikey", "ak-789", "global");
      expect(key).toBe("apikey:ak-789:global");
    });

    it("should use default window type if not specified", () => {
      const key = makeRateLimitKey("ip", "10.0.0.1");
      expect(key).toBe("ip:10.0.0.1:global");
    });
  });

  describe("Tier-based limits", () => {
    it("should return correct limits for solo tier", () => {
      const limits = getTierLimits("solo");
      expect(limits.global).toBe(120);
      expect(limits.auth).toBe(5);
      expect(limits.llm).toBe(20);
      expect(limits.api).toBe(60);
      expect(limits.leads).toBe(30);
    });

    it("should return correct limits for team tier", () => {
      const limits = getTierLimits("team");
      expect(limits.global).toBe(300);
      expect(limits.auth).toBe(10);
      expect(limits.llm).toBe(60);
      expect(limits.api).toBe(300);
      expect(limits.leads).toBe(100);
    });

    it("should return correct limits for agency tier", () => {
      const limits = getTierLimits("agency");
      expect(limits.global).toBe(1000);
      expect(limits.auth).toBe(20);
      expect(limits.llm).toBe(200);
      expect(limits.api).toBe(1000);
      expect(limits.leads).toBe(500);
    });
  });

  describe("Enterprise limiters creation", () => {
    it("should create all limiters without errors", () => {
      const limiters = createEnterpriseLimiters(pool);
      
      expect(limiters.global).toBeDefined();
      expect(limiters.auth).toBeDefined();
      expect(limiters.llm).toBeDefined();
      expect(limiters.api).toBeDefined();
      expect(limiters.leads).toBeDefined();
    });
  });

  describe("Distributed store behavior", () => {
    it("should share state across store instances (distributed)", async () => {
      const store1 = new PostgresRateLimitStore({
        pool,
        tableName: "rate_limit_buckets",
        keyPrefix: "dist-test",
        cleanupIntervalMs: 0,
      });

      const store2 = new PostgresRateLimitStore({
        pool,
        tableName: "rate_limit_buckets",
        keyPrefix: "dist-test",
        cleanupIntervalMs: 0,
      });

      const key = "workspace:shared-ws:global";
      
      // Increment from store1
      await store1.increment(key);
      
      // Should see the increment from store2
      const info = await store2.get(key);
      expect(info?.totalHits).toBe(1);
      
      // Increment from store2
      await store2.increment(key);
      
      // Should see both increments from store1
      const info2 = await store1.get(key);
      expect(info2?.totalHits).toBe(2);
    });
  });
});
