import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "@/components/saas/ReviewQueue";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

function ReviewPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <ReviewQueue />
    </div>
  );
}
