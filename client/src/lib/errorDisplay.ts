/**
 * Unified client-side error display utility.
 * Handles API errors consistently across the application.
 */

import { toast } from "sonner";

export interface ApiErrorResponse {
  ok: boolean;
  code?: string;
  message?: string;
  details?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  requestId?: string;
}

/**
 * Display a validation error with all field-level details.
 */
export function displayValidationError(response: ApiErrorResponse): void {
  const details = response.details ?? [];
  
  if (details.length === 0) {
    toast.error(response.message ?? "Validation failed", {
      description: "Please check your input and try again.",
    });
    return;
  }

  // Show summary toast
  toast.error("Validation Error", {
    description: `${details.length} field(s) need correction`,
  });

  // Show individual field errors
  details.forEach((detail) => {
    toast.error(`Invalid: ${detail.field}`, {
      description: detail.message,
      duration: 5000,
    });
  });
}

/**
 * Display a generic API error based on error code.
 */
export function displayApiError(response: ApiErrorResponse): void {
  const code = response.code ?? "UNKNOWN_ERROR";
  const message = response.message ?? "An unexpected error occurred";

  switch (code) {
    case "VALIDATION_ERROR":
      displayValidationError(response);
      break;
    
    case "AUTHENTICATION_ERROR":
    case "AUTH_FAILED":
      toast.error("Authentication Failed", {
        description: message,
      });
      break;
    
    case "AUTHORIZATION_ERROR":
    case "WORKSPACE_ACCESS_DENIED":
      toast.error("Access Denied", {
        description: message,
      });
      break;
    
    case "NOT_FOUND":
      toast.error("Not Found", {
        description: message,
      });
      break;
    
    case "MONTHLY_LEAD_LIMIT_REACHED":
    case "MONTHLY_API_CALL_LIMIT_REACHED":
      toast.error("Limit Reached", {
        description: message,
        duration: 6000,
      });
      break;
    
    case "STRIPE_NOT_CONFIGURED":
      toast.info("Billing Not Available", {
        description: message,
      });
      break;
    
    case "INVALID_SIGNATURE":
    case "MISSING_SIGNATURE_OR_SECRET":
      toast.error("Security Error", {
        description: "Request signature validation failed.",
      });
      break;
    
    default:
      toast.error(message, {
        description: `Error code: ${code}`,
      });
  }
}

/**
 * Check if a response is an error and display appropriate message.
 * Returns true if error was displayed.
 */
export function handleApiResponse<T extends ApiErrorResponse>(response: T): boolean {
  if (!response.ok) {
    displayApiError(response);
    return true;
  }
  return false;
}

/**
 * Display a success message.
 */
export function displaySuccess(message: string, description?: string): void {
  toast.success(message, {
    description,
  });
}

/**
 * Display a warning message.
 */
export function displayWarning(message: string, description?: string): void {
  toast.warning(message, {
    description,
  });
}

/**
 * Display an info message.
 */
export function displayInfo(message: string, description?: string): void {
  toast.info(message, {
    description,
  });
}
