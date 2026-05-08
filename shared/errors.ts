/**
 * Error Contract for API responses
 * All errors must follow this structure
 */
export interface ErrorContract {
  ok: false;
  code: string;
  message: string;
  requestId?: string;
}

/**
 * Standard error codes used across the application
 */
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Authentication/Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',

  // Business logic errors
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  WORKSPACE_ACCESS_DENIED = 'WORKSPACE_ACCESS_DENIED',
  IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT',

  // External service errors
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  WEBHOOK_ERROR = 'WEBHOOK_ERROR',
}

/**
 * Create a standardized error response
 */
export function createError(
  code: string,
  message: string,
  requestId?: string
): ErrorContract {
  return {
    ok: false,
    code,
    message,
    ...(requestId && { requestId }),
  };
}

/**
 * Common error factory functions
 */
export const Errors = {
  validation: (message: string, requestId?: string): ErrorContract =>
    createError(ErrorCode.VALIDATION_ERROR, message, requestId),

  unauthorized: (message: string = 'Unauthorized', requestId?: string): ErrorContract =>
    createError(ErrorCode.UNAUTHORIZED, message, requestId),

  forbidden: (message: string = 'Forbidden', requestId?: string): ErrorContract =>
    createError(ErrorCode.FORBIDDEN, message, requestId),

  notFound: (resource: string, requestId?: string): ErrorContract =>
    createError(ErrorCode.NOT_FOUND, `${resource} not found`, requestId),

  conflict: (message: string, requestId?: string): ErrorContract =>
    createError(ErrorCode.CONFLICT, message, requestId),

  rateLimited: (message: string = 'Too many requests', requestId?: string): ErrorContract =>
    createError(ErrorCode.RATE_LIMITED, message, requestId),

  internal: (message: string = 'Internal server error', requestId?: string): ErrorContract =>
    createError(ErrorCode.INTERNAL_ERROR, message, requestId),

  insufficientCredits: (requestId?: string): ErrorContract =>
    createError(
      ErrorCode.INSUFFICIENT_CREDITS,
      'Insufficient credits to perform this operation',
      requestId
    ),

  workspaceAccessDenied: (requestId?: string): ErrorContract =>
    createError(
      ErrorCode.WORKSPACE_ACCESS_DENIED,
      'Access denied to this workspace',
      requestId
    ),

  providerError: (provider: string, message: string, requestId?: string): ErrorContract =>
    createError(ErrorCode.PROVIDER_ERROR, `${provider}: ${message}`, requestId),
};
