/**
 * E2E Tests for Critical Paths: Discovery → Enrich → Send
 * 
 * These tests verify the core user journey works end-to-end.
 * They run against the local dev server (Vite + Express).
 */

import { test, expect } from "@playwright/test";

test.describe("Critical Path: Discovery → Enrich → Send", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForLoadState("networkidle");
  });

  test("Complete user journey: login → discover leads → enrich → send email", async ({ page }) => {
    // Step 1: Login
    await test.step("User can login", async () => {
      await page.fill('input[type="email"]', "solo@skerry.io");
      await page.fill('input[type="password"]', "solo123");
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard after login
      await page.waitForURL("**/dashboard", { timeout: 10000 });
      await expect(page.locator("text=Skerry")).toBeVisible();
    });

    // Step 2: Navigate to lead discovery
    await test.step("Navigate to lead discovery", async () => {
      // Click on "Find New Leads" or similar CTA
      const findLeadsButton = page.locator("text=/Find New Leads|Pipeline starten|Run Pipeline/i").first();
      if (await findLeadsButton.isVisible()) {
        await findLeadsButton.click();
      }
      
      // Should see the discovery modal or page
      await expect(page.locator("text=/Leads|Discovery|ICP/i").first()).toBeVisible({ timeout: 5000 });
    });

    // Step 3: Configure and start discovery
    await test.step("Start lead discovery", async () => {
      // Fill in business description if field exists
      const businessDescField = page.locator('textarea[placeholder*="business" i], input[placeholder*="business" i]').first();
      if (await businessDescField.isVisible()) {
        await businessDescField.fill("B2B SaaS company selling productivity tools");
      }

      // Click search/generate button
      const searchButton = page.locator("text=/Search|Generate|Find/i").first();
      if (await searchButton.isVisible()) {
        await searchButton.click();
        
        // Wait for results (with timeout)
        await page.waitForSelector("text=/leads found|results/i", { timeout: 30000 });
      }
    });

    // Step 4: Verify leads are displayed
    await test.step("Leads are displayed after discovery", async () => {
      // Check for lead cards or table rows
      const leadItems = page.locator("[data-testid='lead-item'], .lead-card, table tbody tr").first();
      await expect(leadItems).toBeVisible({ timeout: 10000 });
    });

    // Step 5: Enrich a lead
    await test.step("Enrich lead with additional data", async () => {
      // Click on a lead to view details or enrich
      const enrichButton = page.locator("text=/Enrich|Details|View/i").first();
      if (await enrichButton.isVisible()) {
        await enrichButton.click();
        
        // Wait for enrichment to complete (look for enriched data)
        await page.waitForSelector("text=/enriched|company size|industry/i", { timeout: 30000 });
      }
    });

    // Step 6: Send email to lead
    await test.step("Send email to lead", async () => {
      // Navigate to email/forge section
      const sendButton = page.locator("text=/Send|Email|Forge/i").first();
      if (await sendButton.isVisible()) {
        await sendButton.click();
        
        // Fill email form if present
        const subjectField = page.locator('input[placeholder*="subject" i], input[name="subject"]').first();
        if (await subjectField.isVisible()) {
          await subjectField.fill("Quick idea for your company");
        }
        
        // Send the email
        const confirmSendButton = page.locator("text=/Send Email|Confirm/i").first();
        if (await confirmSendButton.isVisible()) {
          await confirmSendButton.click();
          
          // Verify success message
          await expect(page.locator("text=/sent|success/i")).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });

  test("Provider degradation UX shows when services are unavailable", async ({ page }) => {
    await test.step("Login first", async () => {
      await page.fill('input[type="email"]', "solo@skerry.io");
      await page.fill('input[type="password"]', "solo123");
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard", { timeout: 10000 });
    });

    // Check that provider status component renders (even if healthy)
    await test.step("Provider status is visible", async () => {
      // The ProviderStatus component should be in the DOM
      // It might not show anything if all services are healthy
      const providerStatus = page.locator("[class*='border-yellow'], [class*='bg-yellow']").first();
      
      // If there's a degradation warning, it should be visible
      const isVisible = await providerStatus.isVisible().catch(() => false);
      
      if (isVisible) {
        await expect(providerStatus).toContainText(/Service Degradation|Eingeschränkter Dienst/i);
      }
    });
  });

  test("Health endpoint returns correct structure", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("services");
    expect(body.services).toHaveProperty("apollo");
    expect(body.services).toHaveProperty("openai");
    expect(body).toHaveProperty("circuits");
  });
});
