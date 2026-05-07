/**
 * ProviderStatus Component
 * 
 * Displays the health status of external providers (Apollo, OpenAI, etc.)
 * and their circuit breaker state. Shows degradation warnings when providers
 * are unavailable.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

interface CircuitStatus {
  state: string;
  failureCount: number;
  successCount: number;
  isOpen: boolean;
}

interface HealthResponse {
  ok: boolean;
  version: string;
  services: {
    apollo: boolean;
    openai: boolean;
    resend: boolean;
    neverbounce: boolean;
    supabase: boolean;
    stripe: boolean;
  };
  circuits?: Record<string, CircuitStatus>;
  discovery_provider: string;
  demo_mode: boolean;
  ready_for_production: boolean;
}

interface ProviderStatusProps {
  className?: string;
}

export function ProviderStatus({ className }: ProviderStatusProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const resp = await fetch("/api/health");
        const data = await resp.json() as HealthResponse;
        setHealth(data);
        
        // Show toast notifications for open circuits
        if (data.circuits) {
          for (const [provider, status] of Object.entries(data.circuits)) {
            if (status.isOpen) {
              const message = (t("provider.circuitOpen") as string)?.replace("{provider}", provider) || 
                `${provider} service is temporarily unavailable. Some features may be degraded.`;
              toast.warning(message, { id: `circuit-${provider}` });
            }
          }
        }
      } catch {
        // Silently fail - health check is non-critical
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [t]);

  if (loading || !health) return null;

  const hasUnavailableProviders = health.circuits 
    ? Object.values(health.circuits).some(c => c.isOpen)
    : false;

  if (!hasUnavailableProviders) return null;

  return (
    <div className={`rounded-lg border border-yellow-200 bg-yellow-50 p-3 ${className || ""}`}>
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-yellow-600"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-800">
            {t("provider.degradedTitle") || "Service Degradation"}
          </h4>
          <div className="mt-1 text-xs text-yellow-700">
            {health.circuits && Object.entries(health.circuits)
              .filter(([, status]) => status.isOpen)
              .map(([provider]) => (
                <div key={provider}>
                  {(t("provider.circuitOpenDetail") as string)?.replace("{provider}", provider) || 
                    `${provider} is temporarily unavailable. Retrying automatically...`}
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if a specific provider is available
 */
export function useProviderStatus(provider: string): {
  isAvailable: boolean;
  isOpen: boolean;
  state: string | null;
} {
  const [status, setStatus] = useState<{
    isAvailable: boolean;
    isOpen: boolean;
    state: string | null;
  }>({
    isAvailable: true,
    isOpen: false,
    state: null,
  });

  useEffect(() => {
    const checkProvider = async () => {
      try {
        const resp = await fetch("/api/health");
        const data = await resp.json() as HealthResponse;
        const circuit = data.circuits?.[provider];
        
        setStatus({
          isAvailable: !circuit?.isOpen,
          isOpen: circuit?.isOpen || false,
          state: circuit?.state || null,
        });
      } catch {
        // Assume available if check fails
      }
    };

    checkProvider();
    const interval = setInterval(checkProvider, 30000);
    return () => clearInterval(interval);
  }, [provider]);

  return status;
}
