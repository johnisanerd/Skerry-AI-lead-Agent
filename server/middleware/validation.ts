import { Request, Response, NextFunction } from "express";
import { z } from "zod";

interface ValidationOptions {
  body?: z.ZodSchema<any>;
  query?: z.ZodSchema<any>;
  params?: z.ZodSchema<any>;
}

/**
 * Generic Zod validation middleware factory.
 * Validates req.body, req.query or req.params against a Zod schema.
 *
 * Usage:
 *   app.post("/api/leads", validate({ body: createLeadSchema }), handler);
 *   app.get("/api/leads", validate({ query: listLeadsQuerySchema }), handler);
 */
export function validate(options: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.body) {
      const result = options.body.safeParse(req.body);
      if (!result.success) {
        sendZodError(res, result.error);
        return;
      }
      (req as any).body = result.data;
    }

    if (options.query) {
      const result = options.query.safeParse(req.query);
      if (!result.success) {
        sendZodError(res, result.error);
        return;
      }
      (req as any).query = result.data;
    }

    if (options.params) {
      const result = options.params.safeParse(req.params);
      if (!result.success) {
        sendZodError(res, result.error);
        return;
      }
      (req as any).params = result.data;
    }

    next();
  };
}

/**
 * Format ZodError into a unified error response.
 */
function sendZodError(res: Response, error: any): void {
  const details = error?.issues?.map((e: any) => ({
    field: e.path?.join(".") || "root",
    message: e.message,
    code: e.code,
  })) || [];

  res.status(400).json({
    ok: false,
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    details,
    requestId: (res as any).req?.ctx?.requestId ?? "unknown",
  });
}

/**
 * Common schemas reused across endpoints.
 */
export const commonSchemas = {
  uuid: z.string().uuid("Must be a valid UUID"),
  email: z.string().email("Must be a valid email"),
  workspaceId: z.object({
    workspaceId: z.string().uuid("workspaceId must be a valid UUID"),
  }),
  pagination: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
};

/**
 * Example: Lead creation schema
 */
export const createLeadSchema = z.object({
  email: z.string().email("Valid email required"),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  workspaceId: z.string().uuid("Valid workspaceId required"),
});

/**
 * Example: Sequence creation schema (full version with steps)
 */
export const createSequenceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  workspaceId: z.string().uuid("Valid workspaceId required"),
  steps: z.array(
    z.object({
      stepNumber: z.number().int().min(1),
      delayDays: z.number().int().min(0),
      subjectTemplate: z.string().min(1),
      bodyTemplate: z.string().min(1),
      condition: z.enum(["always", "no_reply", "no_open"]),
    })
  ),
});

/**
 * Example: ICP profile schema
 */
export const icpProfileSchema = z.object({
  workspaceId: z.string().uuid("Valid workspaceId required"),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  jobTitles: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(512),
});

/**
 * Entitlement start schema
 */
export const entitlementStartSchema = z.object({
  requestedLeads: z.coerce.number().int().positive().optional(),
});

/**
 * Generate leads schema
 */
export const generateLeadsSchema = z.object({
  businessDescription: z.string().max(5000).optional(),
  targetAudience: z.string().max(2000).optional(),
  requestedLeads: z.coerce.number().int().positive().optional(),
});

/**
 * Generate email schema
 */
export const generateEmailSchema = z.object({
  lead: z
    .object({
      firstName: z.string().max(200).optional(),
      lastName: z.string().max(200).optional(),
      title: z.string().max(200).optional(),
      organization: z
        .object({ name: z.string().max(300).optional() })
        .optional(),
      websiteContext: z.string().max(5000).optional(),
      personContext: z.string().max(5000).optional(),
      uniqueAngles: z.array(z.string().max(200)).max(10).optional(),
    })
    .optional(),
  businessDescription: z.string().max(5000).optional(),
  senderName: z.string().max(200).optional(),
  angle: z.string().max(300).optional(),
});

/**
 * Verify email schema
 */
export const verifyEmailSchema = z.object({
  email: z.string().email().max(320),
});

/**
 * Send email schema
 */
export const sendEmailSchema = z.object({
  to: z.string().email().max(320),
  subject: z.string().max(300).optional(),
  bodyMarkdown: z.string().min(1).max(50000),
});

/**
 * Enrich leads schema
 */
export const enrichLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
});

/**
 * Persist leads schema
 */
export const persistLeadsSchema = z.object({
  leads: z.array(z.any()).min(1),
});

/**
 * Create sequence schema (simple version for index.ts routes)
 */
export const createSequenceSimpleSchema = z.object({
  name: z.string().min(1).max(300),
  steps: z.array(z.any()).min(1),
});

/**
 * Enroll sequence schema
 */
export const enrollSequenceSchema = z.object({
  leadId: z.string().uuid(),
});

/**
 * Billing checkout schema
 */
export const billingCheckoutSchema = z.object({
  priceId: z.string().min(1),
});

/**
 * GDPR deletion request schema
 */
export const gdprDeletionRequestSchema = z.object({
  leadId: z.string().uuid(),
  requestSource: z.enum(["user_request", "bounce", "complaint"]).optional(),
});

/**
 * Resend webhook schema
 */
export const resendWebhookSchema = z.object({
  events: z.array(z.any()).min(1),
});

/**
 * Update ICP schema
 */
export const updateICPSchema = z.object({
  business_description: z.string().max(5000).optional(),
  ideal_customer: z.string().max(2000).optional(),
  problem_solved: z.string().max(2000).optional(),
});

/**
 * Update brand schema
 */
export const updateBrandSchema = z.object({
  brandName: z.string().max(300).optional(),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  brandPrimaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  customDomain: z.string().optional(),
  fromEmail: z.string().email().max(320).optional(),
});

/**
 * Delete workspace schema
 */
export const deleteWorkspaceSchema = z.object({
  confirmation: z.literal("DELETE_WORKSPACE"),
});

/**
 * Create AB test schema
 */
export const createABTestSchema = z.object({
  sequenceId: z.string().uuid(),
  stepNumber: z.coerce.number().int().positive(),
  variants: z.array(z.any()).min(2),
});

/**
 * Promote AB test schema
 */
export const promoteABTestSchema = z.object({
  winnerVariantId: z.string().uuid(),
});

/**
 * Seed leads schema
 */
export const seedLeadsSchema = z.object({
  count: z.coerce.number().int().positive().max(20).optional(),
  businessDescription: z.string().max(5000).optional(),
  targetAudience: z.string().max(2000).optional(),
});
