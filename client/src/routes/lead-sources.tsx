import { createFileRoute } from "@tanstack/react-router";
import { LeadSources } from "@/components/saas/LeadSources";

export const Route = createFileRoute("/lead-sources")({
  component: LeadSourcesPage,
});

function LeadSourcesPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <LeadSources />
    </div>
  );
}
