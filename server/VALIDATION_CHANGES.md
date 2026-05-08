# Zod Validation Implementation - Complete Solution

## Overview
This document summarizes all changes made to implement comprehensive Zod validation across all API endpoints to address OWASP A03 (Injection) risks.

## Files Modified/Created

### 1. `server/middleware/validation.ts` (MODIFIED)
**Changes:**
- Updated `sendZodError()` to return **422 status code** (Unprocessable Entity) per RFC 4918 and Epic 1 error contract
- Fixed `requestId` extraction to check multiple sources: `req.ctx.requestId`, `req.get("x-request-id")`, and fallback to "unknown"
- Added comprehensive schemas for ALL endpoints:
  - `commonSchemas` - Reusable param/query schemas
  - `billingWebhookSchema` - For Stripe webhook validation
  - `exportLeadsQuerySchema` - For GET /api/leads/export
  - `auditLogsQuerySchema` - For GET /api/audit/logs
  - `workspacesQuerySchema` - For GET /api/workspaces
  - `leadsQuerySchema` - For future GET /api/leads
  - `sequencesQuerySchema` - For GET /api/sequences
  - `abTestResultsQuerySchema` - For GET /api/ab-tests/:id/results
  - `healthQuerySchema` - For GET /api/health
  - `icpProfileSchema` - For ICP endpoints
- Fixed TypeScript errors:
  - `z.record()` now uses `z.record(z.string(), z.any())`
  - `z.literal()` uses `.refine()` for custom error messages instead of `errorMap`

### 2. `server/check-routes.ts` (CREATED)
**Purpose:** CI Gate script to verify all routes have proper validation

**Usage:**
```bash
npx ts-node server/check-routes.ts
```

**Or add to package.json:**
```json
{
  "scripts": {
    "test:validation": "ts-node server/check-routes.ts"
  }
}
```

**What it checks:**
- All POST routes have `validate({ body: ... })` middleware
- All PUT routes have `validate()` middleware
- All DELETE routes have `validate()` middleware
- All GET list endpoints have `validate({ query: ... })` middleware
- All routes with `:id` params have `validate({ params: ... })` middleware

### 3. `server/fuzz-tests.test.ts` (CREATED)
**Purpose:** Fuzz testing for critical endpoints

**Tests cover:**
- `/api/leads/generate` - Boundary values, invalid types, XSS attempts
- `/api/email/send` - Invalid emails, empty bodies, oversized payloads
- `/api/email/generate` - Invalid lead objects, too many uniqueAngles

**Usage:**
```bash
npm test -- server/fuzz-tests.test.ts
```

## Changes Needed in `server/index.ts`

### A. Remove Duplicate Schema Definitions (Lines 1097-1199)
**Action:** Delete lines 1097-1199 (the local schema definitions)

**Reason:** Schemas are now imported from `server/middleware/validation.ts`

### B. Add Validation to Routes Missing It

#### 1. GET /api/workspaces (Line ~1304)
```typescript
app.get(
  "/api/workspaces",
  requireAuth,
  validate({ query: workspacesQuerySchema }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 2. GET /api/workspaces/:id/icp (Line ~1374)
```typescript
app.get(
  "/api/workspaces/:id/icp",
  requireAuth,
  validate({ params: commonSchemas.workspaceIdParam }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 3. POST /api/workspaces/:id/icp (Line ~1412)
Already has `validate({ body: updateICPSchema })` ✓

#### 4. GET /api/entitlements/usage (Line ~1463)
```typescript
app.get(
  "/api/entitlements/usage",
  requireAuth,
  validate({ query: commonSchemas.workspaceIdBody }),  // ADD THIS (optional)
  asyncHandler(async (req, res) => {
```

#### 5. POST /api/entitlements/research/start (Line ~1510)
Already has `validate({ body: entitlementStartSchema })` ✓

#### 6. POST /api/leads/generate (Line ~1572)
Already has `validate({ body: generateLeadsSchema })` ✓

#### 7. POST /api/leads/enrich (Line ~1725)
Already has `validate({ body: enrichLeadsSchema })` ✓

#### 8. POST /api/leads/persist (Line ~1855)
Already has `validate({ body: persistLeadsSchema })` ✓

#### 9. POST /api/dev/seed-leads (Line ~1917)
Already has `validate({ body: seedLeadsSchema })` ✓

#### 10. POST /api/email/generate (Line ~1950)
Already has `validate({ body: generateEmailSchema })` ✓

#### 11. GET /api/ready (Line ~2038)
```typescript
app.get(
  "/api/ready",
  validate({ query: healthQuerySchema }),  // ADD THIS (optional)
  asyncHandler(async (_req, res) => {
```

#### 12. GET /api/health (Line ~2055)
```typescript
app.get(
  "/api/health",
  validate({ query: healthQuerySchema }),  // ADD THIS (optional)
  (_req, res) => {
```

#### 13. GET /api/dev/test-exception (Line ~2081)
No validation needed (dev only, no body/params)

#### 14. POST /api/billing/checkout (Line ~2090)
Already has `validate({ body: billingCheckoutSchema })` ✓

#### 15. POST /api/billing/webhook (Line ~2152)
**CRITICAL - Missing validation!**
```typescript
app.post(
  "/api/billing/webhook",
  validate({ body: billingWebhookSchema }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 16. POST /api/sequences (Line ~2261)
Already has `validate({ body: createSequenceSimpleSchema })` ✓

#### 17. GET /api/sequences (Line ~2304)
```typescript
app.get(
  "/api/sequences",
  requireAuth,
  validate({ query: sequencesQuerySchema }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 18. POST /api/sequences/:id/enroll (Line ~2340)
Already has `validate({ body: enrollSequenceSchema })` ✓
**But needs param validation:**
```typescript
app.post(
  "/api/sequences/:id/enroll",
  requireAuth,
  validate({ 
    params: commonSchemas.sequenceIdParam,
    body: enrollSequenceSchema 
  }),  // UPDATE THIS
  asyncHandler(async (req, res) => {
```

#### 19. DELETE /api/sequences/:id/enrollments/:leadId (Line ~2417)
**Missing validation!**
```typescript
app.delete(
  "/api/sequences/:id/enrollments/:leadId",
  requireAuth,
  validate({ params: commonSchemas.enrollmentParams }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 20. POST /api/ab-tests (Line ~2467)
Already has `validate({ body: createABTestSchema })` ✓

#### 21. GET /api/ab-tests/:id/results (Line ~2508)
```typescript
app.get(
  "/api/ab-tests/:id/results",
  requireAuth,
  validate({ 
    params: commonSchemas.abTestIdParam,
    query: abTestResultsQuerySchema 
  }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 22. POST /api/ab-tests/:id/promote (Line ~2576)
Already has `validate({ body: promoteABTestSchema })` ✓
**But needs param validation:**
```typescript
app.post(
  "/api/ab-tests/:id/promote",
  requireAuth,
  validate({ 
    params: commonSchemas.abTestIdParam,
    body: promoteABTestSchema 
  }),  // UPDATE THIS
  asyncHandler(async (req, res) => {
```

#### 23. GET /api/leads/export (Line ~2621)
```typescript
app.get(
  "/api/leads/export",
  requireAuth,
  validate({ query: exportLeadsQuerySchema }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 24. GET /api/audit/logs (Line ~2726)
```typescript
app.get(
  "/api/audit/logs",
  requireAuth,
  validate({ query: auditLogsQuerySchema }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 25. GET /api/audit/logs/export (Line ~2766)
```typescript
app.get(
  "/api/audit/logs/export",
  requireAuth,
  validate({ query: auditLogsQuerySchema }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 26. POST /api/leads/:id/delete-request (Line ~2848)
**Missing param validation!**
```typescript
app.post(
  "/api/leads/:id/delete-request",
  requireAuth,
  validate({ params: commonSchemas.leadIdParam }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 27. GET /api/workspaces/:id/data-export (Line ~2941)
```typescript
app.get(
  "/api/workspaces/:id/data-export",
  requireAuth,
  validate({ params: commonSchemas.workspaceIdParam }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 28. DELETE /api/workspaces/:id/delete (Line ~3002)
Already has `validate({ body: deleteWorkspaceSchema })` ✓
**But needs param validation:**
```typescript
app.delete(
  "/api/workspaces/:id/delete",
  requireAuth,
  validate({ 
    params: commonSchemas.workspaceIdParam,
    body: deleteWorkspaceSchema 
  }),  // UPDATE THIS
  asyncHandler(async (req, res) => {
```

#### 29. GET /api/workspaces/:id/brand (Line ~3052)
```typescript
app.get(
  "/api/workspaces/:id/brand",
  validate({ params: commonSchemas.workspaceIdParam }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 30. PUT /api/workspaces/:id/brand (Line ~3105)
Already has `validate({ body: updateBrandSchema })` ✓
**But needs param validation:**
```typescript
app.put(
  "/api/workspaces/:id/brand",
  requireAuth,
  validate({ 
    params: commonSchemas.workspaceIdParam,
    body: updateBrandSchema 
  }),  // UPDATE THIS
  asyncHandler(async (req, res) => {
```

#### 31. POST /api/gdpr/deletion-request (Line ~3164)
Already has `validate({ body: gdprDeletionRequestSchema })` ✓

#### 32. GET /api/gdpr/data-export (Line ~3208)
```typescript
app.get(
  "/api/gdpr/data-export",
  requireAuth,
  validate({ query: exportLeadsQuerySchema }),  // ADD THIS
  asyncHandler(async (req, res) => {
```

#### 33. POST /api/webhooks/resend (Line ~3247)
Already has `validate({ body: resendWebhookSchema })` ✓

#### 34. POST /api/email/verify (Line ~3281)
Already has `validate({ body: verifyEmailSchema })` ✓

#### 35. POST /api/email/send (Line ~3339)
Already has `validate({ body: sendEmailSchema })` ✓

## Error Contract Format

All validation errors now return:
```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "field.name",
      "message": "Error message",
      "code": "invalid_type"
    }
  ],
  "requestId": "req_12345"
}
```

**Status Code:** 422 (Unprocessable Entity)

## Running the CI Check

Add to your CI pipeline:
```yaml
- name: Check Route Validation
  run: npm run test:validation
```

Or manually:
```bash
cd /Users/connormcgregor/Documents/Skerry-AI-lead-Agent-main
npx ts-node server/check-routes.ts
```

## Expected Output

If all routes are properly validated:
```
✅ All routes have proper validation middleware!
```

If issues found:
```
❌ OWASP A03 VALIDATION ERRORS:

  - POST /api/billing/webhook (line 2152) - Missing validate() middleware
  - DELETE /api/sequences/:id/enrollments/:leadId (line 2417) - Missing param validation
  ...
```

## Summary of Changes Required in `server/index.ts`

1. **Delete lines 1097-1199** (duplicate schema definitions)
2. **Add param validation** to routes with `:id`:
   - `/api/workspaces/:id/icp` (GET)
   - `/api/sequences/:id/enroll` (POST)
   - `/api/sequences/:id/enrollments/:leadId` (DELETE)
   - `/api/ab-tests/:id/results` (GET)
   - `/api/ab-tests/:id/promote` (POST)
   - `/api/leads/:id/delete-request` (POST)
   - `/api/workspaces/:id/data-export` (GET)
   - `/api/workspaces/:id/delete` (DELETE)
   - `/api/workspaces/:id/brand` (GET, PUT)
3. **Add query validation** to GET endpoints:
   - `/api/workspaces`
   - `/api/sequences`
   - `/api/leads/export`
   - `/api/audit/logs`
   - `/api/audit/logs/export`
   - `/api/ab-tests/:id/results`
   - `/api/gdpr/data-export`
4. **Add body validation** to:
   - `/api/billing/webhook` (POST) - CRITICAL!

## Security Impact

- **Before:** Many routes accepted arbitrary input without validation (OWASP A03 risk)
- **After:** All routes have Zod validation, returning 422 with detailed error messages
- **Compliance:** Meets Epic 1 error contract requirements
