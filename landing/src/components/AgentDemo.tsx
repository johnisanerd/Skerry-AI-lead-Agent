import { useEffect, useRef, useState } from "react";

interface Props {
  url: string;
  icp: string;
  contactsLabel: string;
  stageInputLabel: string;
  stageResearchLabel: string;
  stageDraftLabel: string;
  stageSendLabel: string;
  stageDoneLabel: string;
  resultsTitle: string;
  resultsSuffix: string;
  resultsCount: string;
  matchLabel: string;
  viewAllLabel: string;
  emailSubject: string;
  emailBody: string;
  sentViaLabel: string;
}

type Stage = "typing" | "researching" | "results" | "drafting" | "sent";

const STAGE_ORDER: Stage[] = [
  "typing",
  "researching",
  "results",
  "drafting",
  "sent",
];

const STAGE_DURATION_MS: Record<Stage, number> = {
  typing: 3500,
  researching: 2200,
  results: 3200,
  drafting: 2600,
  sent: 3000,
};

const FAKE_LEADS = [
  {
    initials: "EM",
    name: "Elena Martinez",
    role: "VP Sales · Linear",
    match: 96,
    color: "from-pink-400 to-violet-400",
  },
  {
    initials: "JT",
    name: "James Taylor",
    role: "CEO · Resend",
    match: 93,
    color: "from-cyan-400 to-blue-400",
  },
  {
    initials: "NK",
    name: "Nina Kim",
    role: "Head of Growth · Vercel",
    match: 89,
    color: "from-emerald-400 to-teal-400",
  },
];

export default function AgentDemo(props: Props) {
  const [stage, setStage] = useState<Stage>("typing");
  const [typed, setTyped] = useState("");
  const stageIndex = useRef(0);
  const animationFrame = useRef<number | null>(null);

  // Stage cycle.
  useEffect(() => {
    const tick = () => {
      stageIndex.current = (stageIndex.current + 1) % STAGE_ORDER.length;
      const next = STAGE_ORDER[stageIndex.current];
      setStage(next);
    };
    const id = window.setTimeout(tick, STAGE_DURATION_MS[stage]);
    return () => window.clearTimeout(id);
  }, [stage]);

  // Typewriter for the ICP query during the typing stage. Reset whenever
  // we re-enter typing (full loop).
  useEffect(() => {
    if (stage !== "typing") {
      setTyped(props.icp);
      return;
    }
    setTyped("");
    let i = 0;
    const speed = Math.max(18, Math.min(40, 2200 / props.icp.length));
    const id = window.setInterval(() => {
      i += 1;
      setTyped(props.icp.slice(0, i));
      if (i >= props.icp.length) window.clearInterval(id);
    }, speed);
    return () => {
      window.clearInterval(id);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [stage, props.icp]);

  const stageLabel = (() => {
    switch (stage) {
      case "typing":
        return props.stageInputLabel;
      case "researching":
        return props.stageResearchLabel;
      case "results":
        return `${props.resultsTitle} ${FAKE_LEADS.length} ${props.resultsSuffix}`;
      case "drafting":
        return props.stageDraftLabel;
      case "sent":
        return props.stageDoneLabel;
    }
  })();

  return (
    <div
      className="panel-strong relative mx-auto max-w-4xl overflow-hidden rounded-2xl"
      style={{ boxShadow: "0 30px 90px -20px rgba(167,139,250,0.4)" }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="h-3 w-3 rounded-full bg-rose-400/80" />
        <span className="h-3 w-3 rounded-full bg-amber-400/80" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
        <div
          className="muted-text mx-auto rounded-md px-3 py-1 text-[11px] font-mono"
          style={{ background: "var(--panel)" }}
        >
          {props.url}
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {/* Query bar */}
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-brand-500 dark:text-brand-400 shrink-0"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div className="heading min-h-[1.5em] flex-1 text-sm font-medium">
            {typed}
            {stage === "typing" && (
              <span className="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[1px] animate-pulse bg-brand-500 dark:bg-brand-400 align-middle" />
            )}
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-ink-900 shadow-[0_0_18px_rgba(167,139,250,0.55)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Stage strip */}
        <div className="flex items-center gap-3 text-xs">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {stage !== "sent" && (
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/60" />
            )}
            <span
              className={`relative h-2.5 w-2.5 rounded-full ${stage === "sent" ? "bg-emerald-400" : "bg-brand-400"}`}
            />
          </span>
          <span
            key={stage}
            className="muted-text animate-fade-in"
            style={{ animationDuration: "0.4s" }}
          >
            {stageLabel}
          </span>
          <div
            className="ml-auto h-1 flex-1 max-w-[40%] overflow-hidden rounded-full"
            style={{ background: "var(--panel)" }}
          >
            <div
              className="h-full bg-brand-gradient transition-[width] duration-[2200ms] ease-out"
              style={{
                width:
                  stage === "typing"
                    ? "20%"
                    : stage === "researching"
                      ? "55%"
                      : stage === "results"
                        ? "75%"
                        : stage === "drafting"
                          ? "92%"
                          : "100%",
              }}
            />
          </div>
        </div>

        {/* Result panel — leads or email draft */}
        <div className="min-h-[280px] sm:min-h-[320px]">
          {(stage === "typing" || stage === "researching") && (
            <SourceChips contactsLabel={props.contactsLabel} />
          )}

          {stage === "results" && (
            <div className="space-y-2 animate-fade-in">
              <div
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "rgba(52, 211, 153, 0.25)",
                  background: "rgba(52, 211, 153, 0.06)",
                }}
              >
                <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-300">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12l5 5L20 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    <strong className="font-semibold">
                      {props.resultsTitle}
                    </strong>{" "}
                    <span className="font-bold">{FAKE_LEADS.length}</span>{" "}
                    {props.resultsSuffix}
                  </span>
                </div>
                <span className="text-emerald-500/80 dark:text-emerald-300/80">
                  {FAKE_LEADS.length} {props.resultsCount}
                </span>
              </div>
              {FAKE_LEADS.map((lead, i) => (
                <div
                  key={lead.name}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 animate-slide-in-up"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--panel)",
                    animationDelay: `${i * 0.12}s`,
                  }}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${lead.color} text-[11px] font-bold text-ink-900`}
                  >
                    {lead.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="heading text-sm font-semibold leading-tight">
                      {lead.name}
                    </div>
                    <div className="muted-text text-xs leading-tight">
                      {lead.role}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500 dark:text-emerald-300">
                    {lead.match}%
                  </span>
                </div>
              ))}
              <div className="muted-text pt-1 text-center text-xs">
                + 16 more results · {props.viewAllLabel} →
              </div>
            </div>
          )}

          {(stage === "drafting" || stage === "sent") && (
            <div
              key={stage}
              className="rounded-lg border p-4 sm:p-5 animate-fade-in"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel)",
              }}
            >
              <div className="flex items-center justify-between border-b pb-2 text-xs"
                style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="muted-text">To:</span>
                  <span className="heading font-medium">elena@linear.app</span>
                </div>
                <span className="muted-text font-mono text-[10px]">2:47 PM</span>
              </div>
              <div
                className="heading mt-2 text-sm font-semibold"
                style={{ minHeight: "1.5em" }}
              >
                {props.emailSubject}
              </div>
              <p className="body-text mt-2 text-sm leading-relaxed">
                {stage === "drafting" ? (
                  <TypewriterText text={props.emailBody} speed={20} />
                ) : (
                  props.emailBody
                )}
              </p>
              {stage === "sent" && (
                <div className="mt-4 flex items-center gap-2 rounded-md bg-emerald-400/10 px-3 py-2 text-xs text-emerald-500 dark:text-emerald-300 animate-fade-in">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12l5 5L20 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-semibold">{props.sentViaLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceChips({ contactsLabel }: { contactsLabel: string }) {
  const sources = [
    { label: "Apollo", logo: "🅰️" },
    { label: "Apify", logo: "🕷️" },
    { label: "NeverBounce", logo: "✓" },
    { label: "GPT-4", logo: "✨" },
  ];
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--panel)" }}
          >
            <span aria-hidden="true">{s.logo}</span>
            <span className="heading font-medium">{s.label}</span>
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3 text-emerald-500 dark:text-emerald-400"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12l5 5L20 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ))}
      </div>
      <div className="muted-text text-xs">{contactsLabel}</div>
    </div>
  );
}

function TypewriterText({ text, speed = 24 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return <>{displayed}</>;
}
