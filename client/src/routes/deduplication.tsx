import { createFileRoute } from "@tanstack/react-router";
import { DeduplicationManager } from "@/components/saas/DeduplicationManager";

export const Route = createFileRoute("/deduplication")({
  component: DeduplicationPage,
});

function DeduplicationPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <DeduplicationManager />
    </div>
  );
}
