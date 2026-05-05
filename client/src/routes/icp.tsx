import { createFileRoute } from "@tanstack/react-router";
import { ICPBuilder } from "@/components/nexus/ICPBuilder";

export const Route = createFileRoute("/icp")({
  head: () => ({
    meta: [
      { title: "ICP Builder — Skerry" },
      {
        name: "description",
        content: "Definieren Sie Ihr ideales Kundenprofil für präzise Lead-Discovery.",
      },
    ],
  }),
  component: ICPBuilderPage,
});

function ICPBuilderPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ICP Builder</h1>
        <p className="text-muted-foreground mt-2">
          Definieren Sie Ihr ideales Kundenprofil, damit unser Agent die richtigen Leads finden kann.
        </p>
      </div>
      <ICPBuilder />
    </div>
  );
}
