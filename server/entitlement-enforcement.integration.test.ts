import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntitlementDb } from "./db.js";

describe("Entitlement Enforcement", () => {
  let db: EntitlementDb;

  beforeAll(() => {
    db = new EntitlementDb({ databaseUrl: process.env.DATABASE_URL });
  });

  it("should block when lead limit exceeded", async () => {
    if (!db.isConfigured) return; // Skip if DB not configured
    const workspaceId = "ws_test_block";
    const tier = "solo";
    const usageMonth = "2024-01";
    const limits = { leads: 1, exports: 10, sends: 50, apiCalls: 1000 };

    // First consume should succeed
    const first = await db.consumeWorkspaceEntitlements({
      workspaceId,
      tier,
      usageMonth,
      feature: "leads",
      amount: 1,
      limits,
    });
    expect(first.allowed).toBe(true);
    expect(first.usage.leads).toBe(1);

    // Second should fail
    const second = await db.consumeWorkspaceEntitlements({
      workspaceId,
      tier,
      usageMonth,
      feature: "leads",
      amount: 1,
      limits,
    });
    expect(second.allowed).toBe(false);
    expect(second.usage.leads).toBe(1);
  });
});