import { createFileRoute } from "@tanstack/react-router";
import { SequenceBuilder } from "@/components/nexus/SequenceBuilder";

export const Route = createFileRoute("/sequences")({
  component: SequencePage,
});

function SequencePage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Sequences</h1>
        <p className="text-muted-foreground mt-2">
          Automatisierte Follow-up Kette für Lead Nurturing
        </p>
      </div>
      <SequenceBuilder />
    </div>
  );
}
