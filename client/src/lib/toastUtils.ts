/**
 * Toast utility that integrates with the error message map
 * Use these functions to show error/success toasts with proper internationalization
 */

import { toast } from "sonner";
import { getErrorMessage, extractErrorCode, getUserFriendlyError, type Language } from "./errorMessages";
import { useLanguageStore } from "./i18n";

/**
 * Get the current language from the language store
 * Falls back to 'en' if not available
 */
function getCurrentLanguage(): Language {
  try {
    // This is a helper for non-React contexts
    // In React components, use the hook directly
    return (localStorage.getItem("language") as Language) || "en";
  } catch {
    return "en";
  }
}

/**
 * Show an error toast using the error code map
 * @param error - Error object, error code string, or response with error code
 * @param language - Optional language override
 */
export function showErrorToast(error: any, language?: Language): void {
  const lang = language || getCurrentLanguage();
  const message = getUserFriendlyError(error, lang);
  toast.error(message);
}

/**
 * Show an error toast with a specific error code
 * @param code - The error code from the error map
 * @param language - Optional language override
 */
export function showErrorToastByCode(code: string, language?: Language): void {
  const lang = language || getCurrentLanguage();
  const message = getErrorMessage(code, lang);
  toast.error(message);
}

/**
 * Show a success toast (uses i18n keys or direct messages)
 * @param message - Success message or i18n key
 */
export function showSuccessToast(message: string): void {
  toast.success(message);
}

/**
 * Show a warning toast
 * @param message - Warning message
 */
export function showWarningToast(message: string): void {
  toast.warning(message);
}

/**
 * Show an info toast
 * @param message - Info message
 */
export function showInfoToast(message: string): void {
  toast.info(message);
}

/**
 * Hook-friendly version for React components
 * Use this inside components to get toast functions with proper language support
 */
export function useToastWithErrors() {
  const language = useLanguageStore((state) => state.language);

  return {
    error: (error: any) => showErrorToast(error, language),
    errorByCode: (code: string) => showErrorToastByCode(code, language),
    success: showSuccessToast,
    warning: showWarningToast,
    info: showInfoToast,
  };
}

/**
 * Helper to handle API responses and show appropriate toasts
 * @param response - The API response with { ok, code?, message? } structure
 * @param language - Optional language override
 */
export function handleApiResponse(
  response: { ok: boolean; code?: string; message?: string; error?: string },
  options?: {
    successMessage?: string;
    language?: Language;
  }
): boolean {
  const lang = options?.language || getCurrentLanguage();

  if (response.ok) {
    if (options?.successMessage) {
      showSuccessToast(options.successMessage);
    }
    return true;
  }

  // Handle error
  if (response.code) {
    showErrorToastByCode(response.code, lang);
  } else if (response.error) {
    showErrorToast(response.error, lang);
  } else if (response.message) {
    showErrorToast(response.message, lang);
  } else {
    showErrorToastByCode("INTERNAL_ERROR", lang);
  }

  return false;
}
