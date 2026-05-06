import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EntitlementDb } from "./db.js";

describe("Webhook Idempotency", () => {
  let db: EntitlementDb;

  beforeAll(() => {
    db = new EntitlementDb({ databaseUrl: process.env.DATABASE_URL });
  });

  it("should not process duplicate webhook events", async () => {
    if (!db.isConfigured) return; // Skip if DB not configured
    const eventId = "evt_test_123";
    const workspaceId = "ws_test";

    // First call should succeed
    const first = await db.recordWebhookProcessed(eventId, workspaceId, "checkout.session.completed", {});
    expect(first).toBeUndefined(); // No error

    // Check if processed
    const isProcessed = await db.isWebhookProcessed(eventId, workspaceId);
    expect(isProcessed).toBe(true);

    // Second call should not insert again (on conflict do nothing)
    const second = await db.recordWebhookProcessed(eventId, workspaceId, "checkout.session.completed", {});
    expect(second).toBeUndefined();

    // Still processed
    const stillProcessed = await db.isWebhookProcessed(eventId, workspaceId);
    expect(stillProcessed).toBe(true);
  });
});