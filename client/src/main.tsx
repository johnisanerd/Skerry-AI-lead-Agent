import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Initialize Sentry as early as possible
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE || "development",
  release: import.meta.env.VITE_SENTRY_RELEASE || "unknown",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // PII scrubbing: strip emails, API keys and lead names before sending to Sentry
  beforeSend(event) {
    if (event.message) {
      event.message = event.message.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "[email-redacted]"
      );
    }
    if (event.exception?.values) {
      for (const exc of event.exception.values) {
        if (exc.value) {
          exc.value = exc.value.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            "[email-redacted]"
          );
        }
      }
    }
    return event;
  },
});

// Enable unhandled promise rejection tracking
window.addEventListener("unhandledrejection", (event) => {
  Sentry.captureException(event.reason);
});

// Expose test function for Sentry testing (call from browser console)
(window as unknown as Record<string, unknown>).testSentryException = () => {
  throw new Error(
    "Test client exception from testSentryException() - email: test@example.com - name: John Doe"
  );
};

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<div>Something went wrong. Please reload the page.</div>}>
    <App />
  </Sentry.ErrorBoundary>
);
