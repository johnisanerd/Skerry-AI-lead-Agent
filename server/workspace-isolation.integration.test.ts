import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test_session_secret_at_least_32_chars_long_123";
  process.env.ALLOW_DEMO_AUTH = "true";
  delete process.env.DATABASE_URL;
  const mod = await import("./index");
  app = await mod.buildApp();
});

describe("workspace isolation integration", () => {
  it("rejects cross-workspace reads", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({
      email: "solo@skerry.io",
      password: "solo123",
    });
    expect(login.status).toBe(200);

    const allowed = await agent.get("/api/workspaces/demo-workspace/icp");
    expect(allowed.status).toBe(200);

    const denied = await agent.get("/api/workspaces/other-workspace/icp");
    expect(denied.status).toBe(403);
  });

  it("rejects cross-workspace writes", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({
      email: "solo@skerry.io",
      password: "solo123",
    });
    expect(login.status).toBe(200);

    const session = await agent.get("/api/auth/session");
    expect(session.status).toBe(200);
    expect(typeof session.body.csrfToken).toBe("string");

    const denied = await agent
      .post("/api/sequences")
      .set("x-csrf-token", session.body.csrfToken)
      .set("x-workspace-id", "other-workspace")
      .send({ name: "Test", steps: [] });
    expect(denied.status).toBe(403);
  });
});

