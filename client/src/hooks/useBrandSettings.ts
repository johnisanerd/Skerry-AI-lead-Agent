import { useState, useEffect, useCallback } from "react";
import { getBrandSettings, updateBrandSettings, BrandSettings } from "@/lib/skerryApi";
import { toast } from "sonner";

interface UseBrandSettingsState {
  isLoading: boolean;
  isSaving: boolean;
  settings: BrandSettings | null;
  error: string | null;
}

export function useBrandSettings(workspaceId: string) {
  const [state, setState] = useState<UseBrandSettingsState>({
    isLoading: true,
    isSaving: false,
    settings: null,
    error: null,
  });

  // Fetch brand settings on mount/workspaceId change
  useEffect(() => {
    if (!workspaceId) return;

    const fetchSettings = async () => {
      setState(s => ({ ...s, isLoading: true, error: null }));

      try {
        const response = await getBrandSettings(workspaceId);

        if (!response.ok) {
          throw new Error(response.message || "Konnte Branding-Einstellungen nicht laden");
        }

        setState(s => ({
          ...s,
          settings: response.brand || null,
          isLoading: false,
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unbekannter Fehler";
        setState(s => ({ ...s, error: message, isLoading: false }));
        toast.error(message);
      }
    };

    fetchSettings();
  }, [workspaceId]);

  const saveSettings = useCallback(
    async (newSettings: Partial<BrandSettings>) => {
      if (!workspaceId) return;

      setState(s => ({ ...s, isSaving: true, error: null }));

      try {
        const merged = { ...state.settings, ...newSettings };
        const response = await updateBrandSettings(workspaceId, merged);

        if (!response.ok) {
          throw new Error(response.message || "Konnte Einstellungen nicht speichern");
        }

        setState(s => ({
          ...s,
          settings: response.brand || null,
          isSaving: false,
        }));

        toast.success("Branding-Einstellungen gespeichert");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unbekannter Fehler";
        setState(s => ({ ...s, error: message, isSaving: false }));
        toast.error(message);
      }
    },
    [workspaceId, state.settings]
  );

  return {
    ...state,
    saveSettings,
  };
}
