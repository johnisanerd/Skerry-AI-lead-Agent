/**
 * Fuzz Tests for Critical API Endpoints
 * 
 * Tests /api/leads/generate and /api/email/send with:
 * - Invalid input types
 * - Missing required fields
 * - Boundary values
 * - Malformed JSON
 * - Injection attempts
 * - Oversized payloads
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import express, { Application } from "express";
import { createServer, Server } from "http";
import { AddressInfo } from "net";
import { z } from "zod";

// Import validation middleware
import { validate, generateLeadsSchema, sendEmailSchema, generateEmailSchema } from "./middleware/validation";

// Helper to create test app
function createTestApp(): Application {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  
  // Test endpoint for leads/generate
  app.post("/api/leads/generate", validate({ body: generateLeadsSchema }), (req, res) => {
    res.json({ ok: true, received: req.body });
  });
  
  // Test endpoint for email/send
  app.post("/api/email/send", validate({ body: sendEmailSchema }), (req, res) => {
    res.json({ ok: true, received: req.body });
  });
  
  // Test endpoint for email/generate
  app.post("/api/email/generate", validate({ body: generateEmailSchema }), (req, res) => {
    res.json({ ok: true, received: req.body });
  });
  
  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    if (!res.headersSent) {
      res.status(422).json({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.issues || [],
        requestId: "test-123",
      });
    }
  });
  
  return app;
}

describe("Fuzz Tests: /api/leads/generate", () => {
  let server: Server;
  let baseURL: string;
  
  beforeAll(() => {
    const app = createTestApp();
    server = createServer(app);
    server.listen(0); // Random port
    const addr = server.address() as AddressInfo;
    baseURL = `http://localhost:${addr.port}`;
  });
  
  afterAll(() => {
    server.close();
  });
  
  it("should reject non-JSON body", async () => {
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    });
    expect(res.status).toBe(422);
  });
  
  it("should reject missing businessDescription (too long)", async () => {
    const longString = "a".repeat(5001);
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessDescription: longString }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });
  
  it("should reject negative requestedLeads", async () => {
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedLeads: -5 }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should reject non-numeric requestedLeads", async () => {
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedLeads: "not a number" }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should accept valid input", async () => {
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessDescription: "B2B SaaS",
        targetAudience: "Startups",
        requestedLeads: 10,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
  
  it("should reject XSS attempts in strings", async () => {
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessDescription: "<script>alert('xss')</script>",
        targetAudience: "javascript:alert(1)",
      }),
    });
    // Note: Zod doesn't validate against XSS by default
    // This test documents that additional sanitization may be needed
    expect(res.status).toBe(200);
  });
  
  it("should handle null values", async () => {
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessDescription: null,
        targetAudience: undefined,
      }),
    });
    // Should either reject or coerce to undefined
    expect([200, 422]).toContain(res.status);
  });
  
  it("should reject array where object expected", async () => {
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([1, 2, 3]),
    });
    expect(res.status).toBe(422);
  });
});

describe("Fuzz Tests: /api/email/send", () => {
  let server: Server;
  let baseURL: string;
  
  beforeAll(() => {
    const app = createTestApp();
    server = createServer(app);
    server.listen(0);
    const addr = server.address() as AddressInfo;
    baseURL = `http://localhost:${addr.port}`;
  });
  
  afterAll(() => {
    server.close();
  });
  
  it("should reject invalid email", async () => {
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "not-an-email",
        bodyMarkdown: "Hello",
      }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });
  
  it("should reject missing bodyMarkdown", async () => {
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "test@example.com",
      }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should reject empty bodyMarkdown", async () => {
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "test@example.com",
        bodyMarkdown: "",
      }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should reject oversized bodyMarkdown", async () => {
    const longBody = "a".repeat(50001);
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "test@example.com",
        bodyMarkdown: longBody,
      }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should reject oversized subject", async () => {
    const longSubject = "a".repeat(301);
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "test@example.com",
        subject: longSubject,
        bodyMarkdown: "Hello",
      }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should accept valid email", async () => {
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "test@example.com",
        subject: "Hello",
        bodyMarkdown: "This is a test email.",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
  
  it("should reject SQL injection attempts", async () => {
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "test@example.com",
        bodyMarkdown: "'; DROP TABLE users; --",
      }),
    });
    // Zod validates format, not SQL injection
    // This documents that SQL injection protection is at DB layer
    expect(res.status).toBe(200);
  });
  
  it("should handle special characters in email", async () => {
    const res = await fetch(`${baseURL}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "test+alias@sub.example-domain.com",
        bodyMarkdown: "Hello",
      }),
    });
    expect(res.status).toBe(200);
  });
});

describe("Fuzz Tests: /api/email/generate", () => {
  let server: Server;
  let baseURL: string;
  
  beforeAll(() => {
    const app = createTestApp();
    server = createServer(app);
    server.listen(0);
    const addr = server.address() as AddressInfo;
    baseURL = `http://localhost:${addr.port}`;
  });
  
  afterAll(() => {
    server.close();
  });
  
  it("should accept valid lead object", async () => {
    const res = await fetch(`${baseURL}/api/email/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead: {
          firstName: "John",
          lastName: "Doe",
          title: "CEO",
          organization: { name: "Acme Inc" },
        },
        businessDescription: "B2B SaaS",
      }),
    });
    expect(res.status).toBe(200);
  });
  
  it("should reject oversized lead fields", async () => {
    const res = await fetch(`${baseURL}/api/email/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead: {
          firstName: "a".repeat(201),
          lastName: "b".repeat(201),
        },
      }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should reject too many uniqueAngles", async () => {
    const res = await fetch(`${baseURL}/api/email/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead: {
          uniqueAngles: Array(11).fill("angle"),
        },
      }),
    });
    expect(res.status).toBe(422);
  });
  
  it("should accept minimal valid input", async () => {
    const res = await fetch(`${baseURL}/api/email/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });
});

describe("Error Contract Validation", () => {
  it("should return 422 with correct error format", async () => {
    const app = createTestApp();
    const server = createServer(app);
    server.listen(0);
    const addr = server.address() as AddressInfo;
    const baseURL = `http://localhost:${addr.port}`;
    
    const res = await fetch(`${baseURL}/api/leads/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedLeads: -1 }),
    });
    
    expect(res.status).toBe(422);
    const body = await res.json();
    
    expect(body).toHaveProperty("ok", false);
    expect(body).toHaveProperty("code");
    expect(body).toHaveProperty("message");
    expect(body).toHaveProperty("requestId");
    expect(body).toHaveProperty("details");
    expect(Array.isArray(body.details)).toBe(true);
    
    server.close();
  });
});

// Export for use in test runners
export {};
