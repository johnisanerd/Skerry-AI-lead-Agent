import { createFileRoute } from "@tanstack/react-router";
import { CampaignAnalytics } from "@/components/saas/CampaignAnalytics";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <CampaignAnalytics />
    </div>
  );
}
