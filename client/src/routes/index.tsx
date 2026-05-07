import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Telescope,
  BrainCircuit,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
} from "lucide-react";
import { useLeadStore, type Lead, type PipelineStage } from "@/store/leadStore";
import { useT, type TranslationKey } from "@/lib/i18n";
import { useAccountTierStore } from "@/store/accountTierStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Skerry LeadGen OS" },
      {
        name: "description",
        content: "Enterprise lead generation dashboard.",
      },
    ],
  }),
  component: Dashboard,
});

const stageMeta: Record<
  PipelineStage,
  { labelKey: TranslationKey; tone: string; Icon: typeof Loader2 }
> = {
  source: {
    labelKey: "pulse.stage.scraping",
    tone: "text-primary",
    Icon: Loader2,
  },
  analyze: {
    labelKey: "pulse.stage.analyzing",
    tone: "text-blue-400",
    Icon: BrainCircuit,
  },
  draft: {
    labelKey: "pulse.stage.generating",
    tone: "text-sky-400",
    Icon: Sparkles,
  },
  send: {
    labelKey: "pulse.stage.done",
    tone: "text-emerald-400",
    Icon: CheckCircle2,
  },
};

// Sparkline component for trend visualization
function Sparkline({ data, color = "text-primary" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 48;
  const height = 16;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className={cn("inline-block", color)}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Bento-Box Metric Card
function MetricCard({
  labelKey,
  value,
  metric,
  icon: Icon,
  trendData,
  trendUp,
}: {
  labelKey: TranslationKey;
  value: number;
  metric: string;
  icon: typeof Telescope;
  trendData?: number[];
  trendUp?: boolean;
}) {
  const t = useT();
  return (
    <div className="bento-card-compact flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50">
          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {t(labelKey)}
          </div>
          <div className="text-lg font-semibold tabular-nums text-foreground">
            {value.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {trendData && trendData.length > 0 && (
          <Sparkline
            data={trendData}
            color={trendUp ? "text-emerald-400" : "text-red-400"}
          />
        )}
        <div className="text-[11px] text-muted-foreground">{metric}</div>
      </div>
    </div>
  );
}

// Terminal-style Activity Stream
function ActivityStream({ leads }: { leads: Lead[] }) {
  const t = useT();
  const liveFeed = leads.slice(-12).reverse();

  if (liveFeed.length === 0) {
    return (
      <div className="empty-state py-8">
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-muted/50">
          <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="empty-state-title">No activity yet</div>
        <div className="empty-state-description">
          Start a pipeline run to see leads flowing through the system.
        </div>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link to="/">Find New Leads</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="terminal-text space-y-0.5">
      {liveFeed.map(lead => {
        const meta = stageMeta[lead.stage];
        const Icon = meta.Icon;
        const animate = lead.stage !== "send";
        return (
          <div
            key={lead.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30 transition-colors"
          >
            <Icon
              className={cn(
                "h-3 w-3 shrink-0",
                meta.tone,
                animate && "animate-spin [animation-duration:3s]"
              )}
              strokeWidth={1.5}
            />
            <span className="text-muted-foreground">[{lead.stage}]</span>
            <span className="text-foreground truncate">
              {lead.personal.firstName} {lead.personal.lastName}
            </span>
            <span className="text-muted-foreground/60 truncate">
              · {lead.organization.name}
            </span>
            {lead.personal.email && (
              <span className="text-emerald-400/80 text-[11px] ml-auto">
                ✓ email
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Pipeline Health Bar
function PipelineHealth({ leads }: { leads: Lead[] }) {
  const stages = [
    { key: "source" as PipelineStage, label: "Source", color: "bg-purple-500" },
    { key: "analyze" as PipelineStage, label: "Analyze", color: "bg-blue-500" },
    { key: "draft" as PipelineStage, label: "Draft", color: "bg-sky-500" },
    { key: "send" as PipelineStage, label: "Send", color: "bg-emerald-500" },
  ];

  const counts = stages.map(s => leads.filter(l => l.stage === s.key).length);
  const total = leads.length || 1;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Pipeline Health
      </h3>
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const count = counts[i];
          const pct = ((count / total) * 100).toFixed(0);
          return (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{stage.label}</span>
                <span className="tabular-nums text-foreground">
                  {count} <span className="text-muted-foreground/60">({pct}%)</span>
                </span>
              </div>
              <div className="health-bar">
                <div
                  className={cn("health-bar-fill", stage.color)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Status Pips (GitHub Actions style)
function StatusPips({ leads }: { leads: Lead[] }) {
  const recentLeads = leads.slice(-20);
  return (
    <div className="flex flex-wrap gap-1">
      {recentLeads.map(lead => {
        const color =
          lead.stage === "send"
            ? "status-pip-success"
            : lead.stage === "source"
              ? "status-pip-idle"
              : lead.stage === "analyze"
                ? "status-pip-warning"
                : "status-pip-warning";
        return (
          <div
            key={lead.id}
            className={cn("status-pip", color)}
            title={`${lead.personal.firstName} ${lead.personal.lastName} - ${lead.stage}`}
          />
        );
      })}
      {recentLeads.length === 0 && (
        <span className="text-[11px] text-muted-foreground">No data</span>
      )}
    </div>
  );
}

function Dashboard() {
  const t = useT();
  const tier = useAccountTierStore(s => s.tier);
  const leads = useLeadStore(s => s.leads);
  const stats = useLeadStore(s => s.stats)();
  const isLoading = leads.length === 0;

  const cards = [
    {
      labelKey: "pulse.stat.scanned" as TranslationKey,
      value: stats.total,
      metric: stats.withVerifiedEmail > 0 ? `${stats.withVerifiedEmail} with email` : "no leads yet",
      icon: Telescope,
      trendData: [Math.max(0, stats.total - 3), Math.max(0, stats.total - 2), Math.max(0, stats.total - 1), stats.total],
      trendUp: true,
    },
    {
      labelKey: "pulse.stat.insights" as TranslationKey,
      value: stats.insightsGenerated,
      metric: stats.insightsGenerated > 0 ? "AI-extracted" : "—",
      icon: BrainCircuit,
      trendData: [0, 2, 5, stats.insightsGenerated],
      trendUp: true,
    },
    {
      labelKey: "pulse.stat.newsletters" as TranslationKey,
      value: stats.emailsReady,
      metric: stats.emailsReady > 0 ? "ready to send" : "—",
      icon: FileText,
      trendData: [0, 1, 3, stats.emailsReady],
      trendUp: true,
    },
    {
      labelKey: "pulse.stat.pushed" as TranslationKey,
      value: stats.sent,
      metric: stats.sent > 0 ? "dispatched" : "—",
      icon: Send,
      trendData: [0, 1, 2, stats.sent],
      trendUp: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Bento-Box Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bento-card-compact">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </div>
            ))
          : cards.map((c, i) => (
              <MetricCard key={i} {...c} />
            ))}
      </div>

      {/* Main Content: Activity Stream + Side Panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Terminal-style Activity Stream */}
        <div className="lg:col-span-2 bento-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Activity Stream</h2>
            <span className="text-[11px] text-muted-foreground">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </span>
          </div>
          <ActivityStream leads={leads} />
        </div>

        {/* Side Panel: Health + Pips */}
        <div className="space-y-4">
          <div className="bento-card">
            <PipelineHealth leads={leads} />
          </div>
          <div className="bento-card">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status Overview
            </h3>
            <StatusPips leads={leads} />
          </div>
        </div>
      </div>
    </div>
  );
}
