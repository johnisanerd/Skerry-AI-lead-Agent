import { useState, useCallback } from "react";
import { enrichLeads } from "@/lib/skerryApi";
import { toast } from "sonner";
import { useLeadStore } from "@/store/leadStore";

export interface EnrichedLead {
  id: string;
  companySize?: string;
  industry?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  website?: string;
  revenueRange?: string;
  fundingStage?: string;
  intentScore?: number;
}

interface UseLeadEnrichmentState {
  isLoading: boolean;
  enrichedLeads: EnrichedLead[];
  error: string | null;
}

export function useLeadEnrichment() {
  const updateLeadEnrichment = useLeadStore(
    state => state.updateLeadEnrichment
  );
  const [state, setState] = useState<UseLeadEnrichmentState>({
    isLoading: false,
    enrichedLeads: [],
    error: null,
  });

  const enrichSelectedLeads = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) {
        toast.error("Keine Leads ausgewählt");
        return;
      }

      setState(s => ({ ...s, isLoading: true, error: null }));

      try {
        const response = await enrichLeads(leadIds);

        if (!response.ok) {
          throw new Error(response.error || "Enrichment fehlgeschlagen");
        }

        if (response.enriched) {
          const enrichedArray = response.enriched.map(item => {
            const enrichedLead = {
              id: item.id,
              intentScore: item.intentScore,
              ...(item.enriched as Record<string, unknown>),
            } as EnrichedLead;

            updateLeadEnrichment(item.id, item.enriched, item.intentScore);
            return enrichedLead;
          });

          setState(s => ({
            ...s,
            enrichedLeads: [...s.enrichedLeads, ...enrichedArray],
            isLoading: false,
          }));

          toast.success(
            `${response.enriched.length} Leads angereichert (${response.apiCallsUsed}/${response.monthlyApiCalls} API Calls)`
          );
        } else {
          setState(s => ({ ...s, isLoading: false }));
          toast.success("Keine neuen Enrichment-Daten gefunden");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unbekannter Fehler";
        setState(s => ({ ...s, error: message, isLoading: false }));
        toast.error(message);
      }
    },
    [updateLeadEnrichment]
  );

  return {
    ...state,
    enrichSelectedLeads,
  };
}
