import { useEffect, useState } from "react";

/**
 * Hero-right visual: a stylized "lead radar" — a violet sweep over a
 * dotted constellation, with three orbiting prospect cards that fade in
 * at staggered intervals. Conveys "Skerry is finding leads in the noise".
 *
 * Pure CSS animations, no heavy framework. Decorative — aria-hidden.
 */
export default function LeadPulse() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 24-point constellation grid for the background dots.
  const dots = Array.from({ length: 28 }, (_, i) => {
    // Pseudo-random but deterministic placement.
    const seed = i * 37;
    const x = ((seed * 13) % 100) + ((seed >> 3) % 7) - 3;
    const y = ((seed * 7) % 100) + ((seed >> 5) % 5) - 2;
    return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
  });

  const cards = [
    { name: "Sara K.", role: "VP Sales · Series A SaaS", match: 96, delay: 0.5 },
    { name: "Tomás R.", role: "Founder · DevTools", match: 92, delay: 1.5 },
    { name: "Mei L.", role: "Head of Growth · Fintech", match: 88, delay: 2.5 },
  ];

  return (
    <div
      aria-hidden="true"
      className="relative aspect-square w-full max-w-[480px]"
    >
      {/* Central radar disc with sweep */}
      <div className="absolute inset-[8%] overflow-hidden rounded-full border border-brand-400/20 bg-gradient-to-br from-brand-500/[0.08] to-transparent">
        {/* Concentric rings */}
        <div className="absolute inset-0 rounded-full border border-brand-400/10" />
        <div className="absolute inset-[12%] rounded-full border border-brand-400/15" />
        <div className="absolute inset-[28%] rounded-full border border-brand-400/20" />
        <div className="absolute inset-[44%] rounded-full border border-brand-400/30" />

        {/* Pulse rings */}
        <div className="absolute inset-[44%] rounded-full bg-brand-400/10 animate-pulse-ring" />
        <div
          className="absolute inset-[44%] rounded-full bg-brand-400/10 animate-pulse-ring"
          style={{ animationDelay: "1.3s" }}
        />

        {/* Sweep beam */}
        <div className="absolute inset-0 origin-center">
          <div
            className="absolute left-1/2 top-1/2 h-[50%] w-[50%] origin-top-left"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(167,139,250,0.55), rgba(167,139,250,0) 35%)",
              animation: "sweep 4s linear infinite",
              transformOrigin: "0 0",
            }}
          />
        </div>

        {/* Center hex marker */}
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-brand-400 shadow-[0_0_24px_rgba(167,139,250,0.85)]" />

        {/* Constellation dots */}
        {dots.map((d, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-brand-300/40"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              animation: mounted
                ? `fade-in 1.4s ease ${(i % 6) * 0.18}s both`
                : undefined,
            }}
          />
        ))}

        {/* Highlighted "lead" dots — brighter, larger */}
        {[
          { x: 28, y: 22 },
          { x: 72, y: 36 },
          { x: 60, y: 78 },
        ].map((p, i) => (
          <span
            key={`hi-${i}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-300 shadow-[0_0_12px_rgba(167,139,250,0.9)]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animation: mounted
                ? `fade-in 0.8s ease ${1 + i * 0.4}s both`
                : undefined,
            }}
          />
        ))}
      </div>

      {/* Floating prospect cards orbiting the radar */}
      {cards.map((c, i) => {
        const positions = [
          { top: "8%", right: "0%" },
          { top: "44%", left: "0%" },
          { bottom: "8%", right: "4%" },
        ][i];
        return (
          <div
            key={c.name}
            className="panel-strong absolute flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs"
            style={{
              ...positions,
              animation: mounted
                ? `slide-in-up 0.6s cubic-bezier(0.21,1.02,0.73,1) ${c.delay}s both`
                : "none",
              boxShadow: "0 12px 36px -12px rgba(167,139,250,0.35)",
            }}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-ink-900">
              {c.name
                .split(" ")
                .map((s) => s[0])
                .join("")}
            </div>
            <div className="min-w-0">
              <div className="heading text-[11px] font-semibold leading-tight">
                {c.name}
              </div>
              <div
                className="muted-text text-[10px] leading-tight"
                style={{ fontSize: "10px" }}
              >
                {c.role}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 dark:bg-emerald-300/10 dark:text-emerald-300">
              {c.match}%
            </span>
          </div>
        );
      })}

      <style>{`
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
