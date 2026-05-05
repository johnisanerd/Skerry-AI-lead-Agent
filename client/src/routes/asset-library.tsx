import { createFileRoute } from "@tanstack/react-router";
import { AssetLibrary } from "@/components/saas/AssetLibrary";

export const Route = createFileRoute("/asset-library")({
  component: AssetLibraryPage,
});

function AssetLibraryPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <AssetLibrary />
    </div>
  );
}
