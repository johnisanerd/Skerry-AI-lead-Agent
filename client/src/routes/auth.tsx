import { createFileRoute } from "@tanstack/react-router";
import { ProductionAuth } from "@/components/saas/ProductionAuth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <ProductionAuth />
    </div>
  );
}
