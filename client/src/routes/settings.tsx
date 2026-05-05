import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Languages,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Code2,
  Moon,
  Sun,
  Monitor,
  FileSpreadsheet,
} from "lucide-react";
import { useT, useLanguageStore, type Language } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useAccountTierStore } from "@/store/accountTierStore";
import { TIER_CONFIGS } from "@/store/researchStore";
import { useUsageStore } from "@/store/usageStore";
import { Progress } from "@/components/ui/progress";
import { apiConfig, hasApiKey } from "@/lib/apiConfig";
import { getEntitlementUsage } from "@/lib/skerryApi";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffect } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Skerry" },
      {
        name: "description",
        content: "Manage account, plan, and preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const t = useT();
  const language = useLanguageStore(s => s.language);
  const setLanguage = useLanguageStore(s => s.setLanguage);
  const tier = useAccountTierStore(s => s.tier);
  const setTier = useAccountTierStore(s => s.setTier);
  const config = TIER_CONFIGS[tier];
  const tierLabel = t(`tier.${tier}.label`);
  const tierDescription = t(`tier.${tier}.description`);
  const getTierUsage = useUsageStore(s => s.getTierUsage);
  const setRunsUsedFromServer = useUsageStore(s => s.setRunsUsedFromServer);
  const resetAllUsage = useUsageStore(s => s.resetAllUsage);
  const tierUsage = getTierUsage(tier);
  const user = useAuthStore(s => s.user);
  const isDeveloper = user?.role === "developer";
  const canChangePlan = isDeveloper;
  const { mode, setMode } = useTheme();

  const handleResetOnboarding = () => {
    localStorage.removeItem("skerry-onboarding-profile");
    localStorage.removeItem("skerry-account-tier");
    resetAllUsage();
    window.location.reload();
  };

  const usagePct = Math.round((tierUsage.runsUsed / config.monthlyLimit) * 100);

  useEffect(() => {
    void (async () => {
      const usage = await getEntitlementUsage();
      if (
        usage.ok &&
        usage.tier === tier &&
        typeof usage.runsUsed === "number"
      ) {
        setRunsUsedFromServer(tier, usage.runsUsed);
      }
    })();
  }, [setRunsUsedFromServer, tier]);

  // Status of provider-paid AI services. Customers see a high-level status,
  // never the actual keys. Developers see masked keys.
  const services: Array<{
    service: "openai" | "apify" | "instantly" | "neverbounce" | "resend";
    description: string;
    customerLabel: string;
    developerLabel: string;
  }> = [
    {
      service: "openai",
      description: t("settings.services.openai.description"),
      customerLabel: t("settings.services.openai.label"),
      developerLabel: t("settings.services.openai.devName"),
    },
    {
      service: "apify",
      description: t("settings.services.apify.description"),
      customerLabel: t("settings.services.apify.label"),
      developerLabel: t("settings.services.apify.devName"),
    },
    {
      service: "neverbounce",
      description: t("settings.services.neverbounce.description"),
      customerLabel: t("settings.services.neverbounce.label"),
      developerLabel: t("settings.services.neverbounce.devName"),
    },
    {
      service: "resend",
      description: t("settings.services.resend.description"),
      customerLabel: t("settings.services.resend.label"),
      developerLabel: t("settings.services.resend.devName"),
    },
    {
      service: "instantly",
      description: t("settings.services.instantly.description"),
      customerLabel: t("settings.services.instantly.label"),
      developerLabel: t("settings.services.instantly.devName"),
    },
  ];

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("settings.eyebrow.integrations")}
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {t("settings.servicesHeadingA")}{" "}
          <span className="text-gradient-cyber">
            {t("settings.servicesHeadingB")}
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {isDeveloper
            ? t("settings.servicesDesc.developer")
            : t("settings.servicesDesc.customer")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {services.map(s => {
          const ok = hasApiKey(s.service);
          return (
            <div
              key={s.service}
              className="flex items-center gap-4 rounded-xl glass p-4"
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${ok ? "bg-emerald-500/10" : "bg-amber-500/10"}`}
              >
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {isDeveloper
                      ? s.developerLabel
                      : t(`settings.services.${s.service}.label`)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ok ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
                  >
                    {ok
                      ? t("settings.status.connected")
                      : t("settings.status.notConfigured")}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t(`settings.services.${s.service}.description`)}
                </p>
                {isDeveloper && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-black/30 px-2.5 py-1 ring-1 ring-white/5">
                    <KeyRound className="h-3 w-3 text-muted-foreground" />
                    <code className="font-mono text-[11px] text-foreground/70">
                      {ok
                        ? `${apiConfig[s.service].slice(0, 8)}…${apiConfig[s.service].slice(-4)}`
                        : t("settings.emptyEnv")}
                    </code>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isDeveloper && (
        <div className="flex items-start gap-3 rounded-xl glass p-4 ring-1 ring-purple-500/15">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-700 dark:text-purple-300" />
          <div className="text-xs text-foreground/80">
            <div className="font-semibold text-foreground">
              {t("settings.customerManaged.title")}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {t("settings.customerManaged.subtitle")}
            </div>
          </div>
        </div>
      )}

      {isDeveloper && (
        <div className="flex items-start gap-3 rounded-xl glass p-4 ring-1 ring-purple-500/20">
          <Code2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-300" />
          <div className="text-xs text-foreground/80">
            <div className="font-semibold text-foreground">
              {t("settings.developerView.title")}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {t("settings.developerView.subtitle")}
            </div>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-white/5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("settings.eyebrow.account")}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("settings.title.planUsage")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("settings.planUsage.subtitle")}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {(["solo", "team", "agency"] as const).map(planTier => {
            const cfg = TIER_CONFIGS[planTier];
            const active = tier === planTier;
            const canSelect = canChangePlan && !active;
            const borderColors = {
              solo: active
                ? "border-slate-400/40 bg-slate-500/10"
                : "border-white/10 bg-white/5",
              team: active
                ? "border-blue-400/40 bg-blue-500/10"
                : "border-white/10 bg-white/5",
              agency: active
                ? "border-purple-400/40 bg-purple-500/10"
                : "border-white/10 bg-white/5",
            };
            const labelColors = {
              solo: "text-slate-300",
              team: "text-blue-300",
              agency: "text-purple-300",
            };
            return (
              <button
                key={planTier}
                type="button"
                onClick={() => {
                  if (canSelect) setTier(planTier);
                }}
                disabled={!canSelect}
                className={`rounded-xl border p-4 text-left transition ${borderColors[planTier]} ${!canSelect ? "opacity-70 cursor-not-allowed" : "hover:shadow-lg"}`}
              >
                <div
                  className={`text-sm font-semibold capitalize ${labelColors[planTier]}`}
                >
                  {planTier}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t(`tier.${planTier}.label`)}
                </div>
                <div className="mt-2 text-[11px] text-foreground/60">
                  {cfg.monthlyLimit} {t("settings.planUsage.leadsPerMonth")}
                </div>
                {active && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {t("common.active")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {!canChangePlan && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
            <div className="font-semibold">
              {t("settings.planUsage.locked")}
            </div>
            <p className="mt-1 text-amber-200/90">
              {t("settings.planUsage.lockedDesc")}
            </p>
          </div>
        )}
        <div className="mt-4 rounded-xl glass p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t("settings.planUsage.monthlyUsage")} ({tierLabel})
            </span>
            <span className="text-foreground">
              {tierUsage.runsUsed} / {config.monthlyLimit}{" "}
              {t("settings.planUsage.runs")}
            </span>
          </div>
          <Progress value={usagePct} className="h-1.5" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {tierDescription}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("settings.planUsage.leadsGenerated")}: {tierUsage.leadsGenerated}{" "}
            · {t("settings.planUsage.estimatedSpend")}: $
            {tierUsage.estimatedSpendUsd.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("settings.eyebrow.preferences")}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("settings.title.language")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("settings.language.subtitle")}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl glass p-2">
          <Languages className="ml-2 h-4 w-4 text-purple-700 dark:text-purple-300" />
          {(["en", "de"] as const).map(lang => {
            const active = language === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang as Language)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-purple-500/10 text-purple-800 ring-1 ring-purple-500/30 dark:bg-purple-300/15 dark:text-purple-100 dark:ring-purple-300/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "en"
                  ? t("settings.language.en")
                  : t("settings.language.de")}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="text-base font-semibold tracking-tight">
            {t("settings.theme.title")}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("settings.theme.subtitle")}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl glass p-2">
            {[
              {
                value: "light" as const,
                label: t("settings.theme.light"),
                icon: Sun,
              },
              {
                value: "dark" as const,
                label: t("settings.theme.dark"),
                icon: Moon,
              },
              {
                value: "system" as const,
                label: t("settings.theme.system"),
                icon: Monitor,
              },
            ].map(themeOption => {
              const active = mode === themeOption.value;
              const Icon = themeOption.icon;
              return (
                <button
                  key={themeOption.value}
                  type="button"
                  onClick={() => setMode(themeOption.value)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-purple-500/10 text-purple-800 ring-1 ring-purple-500/30 dark:bg-purple-300/15 dark:text-purple-100 dark:ring-purple-300/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {themeOption.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("settings.eyebrow.enterprise")}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("branding.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("branding.subtitle")}
        </p>
        <Button
          onClick={() => (window.location.href = "/branding")}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition ring-1 ring-white/10"
        >
          <Sparkles className="h-4 w-4" />
          {t("settings.actions.configureBranding")}
        </Button>
      </div>

      <div className="pt-2 border-t border-white/5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("settings.eyebrow.compliance")}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("audit.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("audit.subtitle")}
        </p>
        <Button
          onClick={() => (window.location.href = "/audit")}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition ring-1 ring-white/10"
        >
          <ShieldCheck className="h-4 w-4" />
          {t("settings.actions.viewAuditLogs")}
        </Button>
      </div>

      <div className="pt-2 border-t border-white/5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("settings.eyebrow.gdpr")}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("gdpr.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("gdpr.subtitle")}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => (window.location.href = "/workspace")}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition ring-1 ring-white/10"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t("gdpr.exportData")}
          </Button>
          <Button
            onClick={() => (window.location.href = "/workspace")}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 transition ring-1 ring-red-500/30"
          >
            <RotateCcw className="h-4 w-4" />
            {t("gdpr.deleteAccount")}
          </Button>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("settings.eyebrow.system")}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("settings.onboarding.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("settings.onboarding.subtitle")}
        </p>
        <Button
          onClick={handleResetOnboarding}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition ring-1 ring-white/10"
        >
          <RotateCcw className="h-4 w-4" />
          {t("settings.onboarding.reset")}
        </Button>
      </div>
    </div>
  );
}

// Unused import kept for visual consistency in case Sparkles is used in section icons later
void Sparkles;
