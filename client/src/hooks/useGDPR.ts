import { useState, useCallback } from "react";
import { requestDataDeletion, requestDataExport } from "@/lib/skerryApi";
import { toast } from "sonner";

interface UseGDPRState {
  isLoading: boolean;
  isDeletionRequested: boolean;
  deletionError: string | null;
}

export function useGDPR() {
  const [state, setState] = useState<UseGDPRState>({
    isLoading: false,
    isDeletionRequested: false,
    deletionError: null,
  });

  const requestLeadDeletion = useCallback(async (leadId: string) => {
    setState(s => ({ ...s, isLoading: true, deletionError: null }));

    try {
      const response = await requestDataDeletion(leadId);

      if (!response.ok) {
        throw new Error(response.error || "Löschantrag fehlgeschlagen");
      }

      setState(s => ({
        ...s,
        isDeletionRequested: true,
        isLoading: false,
      }));

      toast.success(
        response.message || "Löschantrag erstellt. Daten werden innerhalb von 30 Tagen gelöscht."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler";
      setState(s => ({ ...s, deletionError: message, isLoading: false }));
      toast.error(message);
    }
  }, []);

  const exportAllData = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }));

    try {
      const blob = await requestDataExport();

      if (!blob) {
        throw new Error("Datenexport fehlgeschlagen");
      }

      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skerry-gdpr-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setState(s => ({ ...s, isLoading: false }));
      toast.success("Ihre Daten wurden exportiert");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler";
      setState(s => ({ ...s, deletionError: message, isLoading: false }));
      toast.error(message);
    }
  }, []);

  return {
    ...state,
    requestLeadDeletion,
    exportAllData,
  };
}
