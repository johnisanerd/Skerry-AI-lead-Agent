import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceManager } from "@/components/saas/WorkspaceManager";

export const Route = createFileRoute("/workspaces")({
  component: WorkspacesPage,
});

function WorkspacesPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <WorkspaceManager />
    </div>
  );
}
