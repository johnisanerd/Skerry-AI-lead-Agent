import { createFileRoute } from "@tanstack/react-router";
import { ICPBuilder } from "@/components/nexus/ICPBuilder";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/icp")({
  head: () => ({
    meta: [
      { title: "ICP Builder — Skerry" },
      {
        name: "description",
        content:
          "Definieren Sie Ihr ideales Kundenprofil für präzise Lead-Discovery.",
      },
    ],
  }),
  component: ICPBuilderPage,
});

function ICPBuilderPage() {
  const t = useT();
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("icp.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("icp.subtitle")}</p>
      </div>
      <ICPBuilder />
    </div>
  );
}
