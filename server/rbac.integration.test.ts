import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test_session_secret_at_least_32_chars_long_123";
  process.env.ALLOW_DEMO_AUTH = "true";
  process.env.DEMO_WORKSPACE_ROLE = "viewer";
  delete process.env.DATABASE_URL;
  const mod = await import("./index");
  app = await mod.buildApp();
});

describe("rbac integration", () => {
  it("blocks viewer from starting lead discovery", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({
      email: "solo@skerry.io",
      password: "solo123",
    });
    expect(login.status).toBe(200);

    const resp = await agent.post("/api/leads/generate").send({
      requestedLeads: 1,
      businessDescription: "B2B SaaS",
      targetAudience: "Founders",
    });
    expect(resp.status).toBe(403);
  });

  it("blocks viewer from creating sequences", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({
      email: "solo@skerry.io",
      password: "solo123",
    });
    expect(login.status).toBe(200);
    const session = await agent.get("/api/auth/session");
    expect(session.status).toBe(200);

    const resp = await agent
      .post("/api/sequences")
      .set("x-csrf-token", session.body.csrfToken)
      .send({ name: "Test", steps: [] });
    expect(resp.status).toBe(403);
  });
});

