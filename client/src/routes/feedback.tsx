import { createFileRoute } from "@tanstack/react-router";
import { HumanFeedbackLoop } from "@/components/saas/HumanFeedbackLoop";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
});

function FeedbackPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <HumanFeedbackLoop />
    </div>
  );
}
