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
        sendZodError(res, result.error, req);
        return;
      }
      (req as any).body = result.data;
    }

    if (options.query) {
      const result = options.query.safeParse(req.query);
      if (!result.success) {
        sendZodError(res, result.error, req);
        return;
      }
      (req as any).query = result.data;
    }

    if (options.params) {
      const result = options.params.safeParse(req.params);
      if (!result.success) {
        sendZodError(res, result.error, req);
        return;
      }
      (req as any).params = result.data;
    }

    next();
  };
}

/**
 * Format ZodError into a unified error response.
 * Uses 422 status code (Unprocessable Entity) as per RFC 4918 and Epic 1 error contract.
 */
function sendZodError(res: Response, error: any, req?: Request): void {
  const details = error?.issues?.map((e: any) => ({
    field: e.path?.join(".") || "root",
    message: e.message,
    code: e.code,
  })) || [];

  // Extract requestId from request context, header, or fallback
  const requestId = 
    (req as any)?.ctx?.requestId ?? 
    req?.get("x-request-id") ?? 
    (res as any).req?.ctx?.requestId ?? 
    "unknown";

  res.status(422).json({
    ok: false,
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    details,
    requestId,
  });
}

/**
 * Common schemas reused across endpoints.
 */
export const commonSchemas = {
  uuid: z.string().uuid("Must be a valid UUID"),
  email: z.string().email("Must be a valid email").max(320),
  workspaceIdParam: z.object({
    id: z.string().uuid("workspaceId must be a valid UUID"),
  }),
  workspaceIdBody: z.object({
    workspaceId: z.string().uuid("workspaceId must be a valid UUID"),
  }),
  pagination: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
  sequenceIdParam: z.object({
    id: z.string().uuid("sequenceId must be a valid UUID"),
  }),
  leadIdParam: z.object({
    id: z.string().uuid("leadId must be a valid UUID"),
  }),
  enrollmentParams: z.object({
    id: z.string().uuid("sequenceId must be a valid UUID"),
    leadId: z.string().uuid("leadId must be a valid UUID"),
  }),
  abTestIdParam: z.object({
    id: z.string().uuid("abTestId must be a valid UUID"),
  }),
};

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: z.string().email("Valid email required").max(320),
  password: z.string().min(1, "Password is required").max(512),
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
  businessDescription: z.string().max(5000, "Description too long").optional(),
  targetAudience: z.string().max(2000, "Target audience too long").optional(),
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
  email: z.string().email("Valid email required").max(320),
});

/**
 * Send email schema
 */
export const sendEmailSchema = z.object({
  to: z.string().email("Valid recipient email required").max(320),
  subject: z.string().max(300).optional(),
  bodyMarkdown: z.string().min(1, "Email body is required").max(50000, "Email body too long"),
});

/**
 * Enrich leads schema
 */
export const enrichLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid("Each leadId must be a valid UUID")).min(1, "At least one leadId is required"),
});

/**
 * Persist leads schema
 */
export const persistLeadsSchema = z.object({
  leads: z.array(z.any()).min(1, "At least one lead is required"),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
});

/**
 * Create sequence schema (full version with steps)
 */
export const createSequenceSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  workspaceId: z.string().uuid("Valid workspaceId required"),
  steps: z.array(
    z.object({
      stepNumber: z.number().int().min(1, "Step number must be positive"),
      delayDays: z.number().int().min(0, "Delay cannot be negative"),
      subjectTemplate: z.string().min(1, "Subject template is required"),
      bodyTemplate: z.string().min(1, "Body template is required"),
      condition: z.enum(["always", "no_reply", "no_open"]),
    })
  ).min(1, "At least one step is required"),
});

/**
 * Create sequence schema (simple version for index.ts routes)
 */
export const createSequenceSimpleSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  steps: z.array(z.any()).min(1, "At least one step is required"),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
});

/**
 * Enroll sequence schema
 */
export const enrollSequenceSchema = z.object({
  leadId: z.string().uuid("leadId must be a valid UUID"),
});

/**
 * Billing checkout schema
 */
export const billingCheckoutSchema = z.object({
  priceId: z.string().min(1, "priceId is required"),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/**
 * Billing webhook schema
 */
export const billingWebhookSchema = z.object({
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.string(), z.any()),
  }),
});

/**
 * GDPR deletion request schema
 */
export const gdprDeletionRequestSchema = z.object({
  leadId: z.string().uuid("leadId must be a valid UUID"),
  requestSource: z.enum(["user_request", "bounce", "complaint"]).optional(),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
});

/**
 * Resend webhook schema
 */
export const resendWebhookSchema = z.object({
  events: z.array(z.any()).min(1, "At least one event is required"),
});

/**
 * Update ICP schema
 */
export const updateICPSchema = z.object({
  business_description: z.string().max(5000).optional(),
  ideal_customer: z.string().max(2000).optional(),
  problem_solved: z.string().max(2000).optional(),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
});

/**
 * Update brand schema
 */
export const updateBrandSchema = z.object({
  brandName: z.string().max(300).optional(),
  brandLogoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  brandPrimaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
  customDomain: z.string().optional(),
  fromEmail: z.string().email("Must be a valid email").max(320).optional(),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
});

/**
 * Delete workspace schema
 */
export const deleteWorkspaceSchema = z.object({
  confirmation: z.string().refine(val => val === "DELETE_WORKSPACE", {
    message: "Confirmation must be exactly 'DELETE_WORKSPACE'",
  }),
});

/**
 * Create AB test schema
 */
export const createABTestSchema = z.object({
  sequenceId: z.string().uuid("sequenceId must be a valid UUID"),
  stepNumber: z.coerce.number().int().positive("Step number must be positive"),
  variants: z.array(z.any()).min(2, "At least two variants are required"),
});

/**
 * Promote AB test schema
 */
export const promoteABTestSchema = z.object({
  winnerVariantId: z.string().uuid("winnerVariantId must be a valid UUID"),
});

/**
 * Seed leads schema (dev only)
 */
export const seedLeadsSchema = z.object({
  count: z.coerce.number().int().positive().max(20, "Maximum 20 leads for dev seeding").optional(),
  businessDescription: z.string().max(5000).optional(),
  targetAudience: z.string().max(2000).optional(),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
});

/**
 * Export leads query schema
 */
export const exportLeadsQuerySchema = z.object({
  format: z.enum(["csv", "hubspot", "salesforce"]).optional().default("csv"),
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
});

/**
 * Audit logs query schema
 */
export const auditLogsQuerySchema = z.object({
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Workspaces query schema
 */
export const workspacesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Leads query schema
 */
export const leadsQuerySchema = z.object({
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
  status: z.enum(["new", "contacted", "replied", "converted", "unsubscribed"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Sequences query schema
 */
export const sequencesQuerySchema = z.object({
  workspaceId: z.string().uuid("Valid workspaceId required").optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * AB test results query schema
 */
export const abTestResultsQuerySchema = z.object({
  includeDetails: z.coerce.boolean().optional(),
});

/**
 * Health check query schema
 */
export const healthQuerySchema = z.object({
  detailed: z.coerce.boolean().optional(),
});

/**
 * ICP profile schema (for GET/POST /api/workspaces/:id/icp)
 */
export const icpProfileSchema = z.object({
  workspaceId: z.string().uuid("Valid workspaceId required"),
  industry: z.string().max(200).optional(),
  companySize: z.string().max(100).optional(),
  jobTitles: z.array(z.string().max(100)).max(50).optional(),
  locations: z.array(z.string().max(100)).max(50).optional(),
  technologies: z.array(z.string().max(100)).max(50).optional(),
  businessDescription: z.string().max(5000).optional(),
  idealCustomer: z.string().max(2000).optional(),
  problemSolved: z.string().max(2000).optional(),
});
