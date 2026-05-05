import { createFileRoute } from "@tanstack/react-router";
import { SequenceBuilder } from "@/components/nexus/SequenceBuilder";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/sequences")({
  component: SequencePage,
});

function SequencePage() {
  const t = useT();
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("sequences.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("sequences.subtitle")}</p>
      </div>
      <SequenceBuilder />
    </div>
  );
}
