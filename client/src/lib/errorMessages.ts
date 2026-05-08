/**
 * Error message mappings for the application
 * Maps error codes to user-friendly messages in German and English
 */

export type Language = 'de' | 'en';

export interface ErrorMessage {
  de: string;
  en: string;
}

/**
 * Map of error codes to messages in German and English
 */
export const errorMessages: Record<string, ErrorMessage> = {
  // Validation errors
  VALIDATION_ERROR: {
    de: 'Ungültige Eingabe. Bitte überprüfen Sie Ihre Daten.',
    en: 'Invalid input. Please check your data.',
  },
  INVALID_INPUT: {
    de: 'Die eingegebenen Daten sind ungültig.',
    en: 'The provided data is invalid.',
  },

  // Authentication/Authorization errors
  UNAUTHORIZED: {
    de: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.',
    en: 'You are not logged in. Please sign in.',
  },
  FORBIDDEN: {
    de: 'Zugriff verweigert. Sie haben keine Berechtigung für diese Aktion.',
    en: 'Access denied. You do not have permission for this action.',
  },
  INSUFFICIENT_PERMISSIONS: {
    de: 'Unzureichende Berechtigungen für diese Aktion.',
    en: 'Insufficient permissions for this action.',
  },
  AUTH_REQUIRED: {
    de: 'Anmeldung erforderlich.',
    en: 'Authentication required.',
  },
  PERMISSION_DENIED: {
    de: 'Zugriff verweigert.',
    en: 'Permission denied.',
  },

  // Resource errors
  NOT_FOUND: {
    de: 'Die angeforderte Ressource wurde nicht gefunden.',
    en: 'The requested resource was not found.',
  },
  CONFLICT: {
    de: 'Ein Konflikt ist aufgetreten. Die Ressource existiert möglicherweise bereits.',
    en: 'A conflict occurred. The resource may already exist.',
  },
  ALREADY_EXISTS: {
    de: 'Diese Ressource existiert bereits.',
    en: 'This resource already exists.',
  },

  // Rate limiting
  RATE_LIMITED: {
    de: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
    en: 'Too many requests. Please try again later.',
  },

  // Server errors
  INTERNAL_ERROR: {
    de: 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
    en: 'An internal error occurred. Please try again later.',
  },
  SERVICE_UNAVAILABLE: {
    de: 'Der Dienst ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.',
    en: 'The service is currently unavailable. Please try again later.',
  },
  TIMEOUT: {
    de: 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.',
    en: 'The request timed out. Please try again.',
  },

  // Business logic errors
  INSUFFICIENT_CREDITS: {
    de: 'Nicht genügend Guthaben. Bitte upgraden Sie Ihren Plan.',
    en: 'Insufficient credits. Please upgrade your plan.',
  },
  WORKSPACE_ACCESS_DENIED: {
    de: 'Zugriff auf diesen Arbeitsbereich verweigert.',
    en: 'Access to this workspace denied.',
  },
  IDEMPOTENCY_KEY_CONFLICT: {
    de: 'Diese Anfrage wurde bereits verarbeitet.',
    en: 'This request has already been processed.',
  },

  // External service errors
  PROVIDER_ERROR: {
    de: 'Ein Fehler ist bei einem externen Dienst aufgetreten.',
    en: 'An error occurred with an external service.',
  },
  WEBHOOK_ERROR: {
    de: 'Ein Fehler ist bei der Webhook-Verarbeitung aufgetreten.',
    en: 'An error occurred while processing the webhook.',
  },

  // Additional common errors
  INVALID_CREDENTIALS: {
    de: 'Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.',
    en: 'Invalid credentials. Please check your email and password.',
  },
  EMAIL_NOT_VERIFIED: {
    de: 'Ihre E-Mail-Adresse wurde noch nicht verifiziert.',
    en: 'Your email address has not been verified yet.',
  },
  WORKSPACE_NOT_FOUND: {
    de: 'Der Arbeitsbereich wurde nicht gefunden.',
    en: 'Workspace not found.',
  },
  LEAD_NOT_FOUND: {
    de: 'Der Lead wurde nicht gefunden.',
    en: 'Lead not found.',
  },
  SEQUENCE_NOT_FOUND: {
    de: 'Die Sequenz wurde nicht gefunden.',
    en: 'Sequence not found.',
  },
  ENRICHMENT_FAILED: {
    de: 'Die Anreicherung der Daten ist fehlgeschlagen.',
    en: 'Data enrichment failed.',
  },
  EMAIL_SEND_FAILED: {
    de: 'Der E-Mail-Versand ist fehlgeschlagen.',
    en: 'Email sending failed.',
  },
  EXPORT_FAILED: {
    de: 'Der Export ist fehlgeschlagen.',
    en: 'Export failed.',
  },
  GDPR_REQUEST_FAILED: {
    de: 'Die DSGVO-Anfrage ist fehlgeschlagen.',
    en: 'GDPR request failed.',
  },
};

/**
 * Get error message for a specific error code and language
 */
export function getErrorMessage(code: string, language: Language = 'en'): string {
  const error = errorMessages[code];
  if (!error) {
    return language === 'de'
      ? 'Ein unbekannter Fehler ist aufgetreten.'
      : 'An unknown error occurred.';
  }
  return error[language];
}

/**
 * Extract error code from various error response formats
 */
export function extractErrorCode(error: any): string {
  // Check for Error-Contract format { ok: false, code: string, message: string }
  if (error?.code && typeof error.code === 'string') {
    return error.code;
  }

  // Check for axios error response
  if (error?.response?.data?.code) {
    return error.response.data.code;
  }

  // Check for fetch error response
  if (error?.data?.code) {
    return error.data.code;
  }

  return 'INTERNAL_ERROR';
}

/**
 * Get user-friendly error message from an error object
 */
export function getUserFriendlyError(error: any, language: Language = 'en'): string {
  const code = extractErrorCode(error);
  return getErrorMessage(code, language);
}
