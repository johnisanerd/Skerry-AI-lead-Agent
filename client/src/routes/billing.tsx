import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { showErrorToast, handleApiResponse } from "@/lib/toastUtils";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { currentId } = useWorkspaceStore();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const t = useT();

  const billingPlans = [
    {
      id: "solo",
      price: "$29",
      priceId: "price_solo_placeholder",
      featureKeys: [
        "billing.plan.solo.feature.1",
        "billing.plan.solo.feature.2",
        "billing.plan.solo.feature.3",
        "billing.plan.solo.feature.4",
      ],
      highlight: false,
    },
    {
      id: "team",
      price: "$79",
      priceId: "price_team_placeholder",
      featureKeys: [
        "billing.plan.team.feature.1",
        "billing.plan.team.feature.2",
        "billing.plan.team.feature.3",
        "billing.plan.team.feature.4",
      ],
      highlight: true,
    },
    {
      id: "agency",
      price: "$199",
      priceId: "price_agency_placeholder",
      featureKeys: [
        "billing.plan.agency.feature.1",
        "billing.plan.agency.feature.2",
        "billing.plan.agency.feature.3",
        "billing.plan.agency.feature.4",
      ],
      highlight: false,
    },
  ] as const;

  const handleChoosePlan = async (priceId: string, planId: string) => {
    if (planId === "agency") {
      toast.info(t("billing.toast.contactSales"));
      return;
    }

    setIsProcessing(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceId,
          workspaceId: currentId,
        }),
      });
      const data = await res.json();

      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.code === "STRIPE_NOT_CONFIGURED") {
        toast.info(t("billing.toast.notConfigured"));
        return;
      }

      // Use the error code from the response to show proper error message
      showErrorToast(data);
    } catch (err) {
      showErrorToast(err);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">{t("billing.title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("billing.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {billingPlans.map(plan => (
          <div
            key={plan.id}
            className={`rounded-3xl border p-6 shadow-sm transition ${plan.highlight ? "border-primary/30 bg-primary/5 shadow-primary/10" : "border-border bg-card"}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {t(`billing.plan.${plan.id}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`billing.plan.${plan.id}.description`)}
                </p>
              </div>
              <span className="text-3xl font-bold">{plan.price}</span>
            </div>
            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              {plan.featureKeys.map(featureKey => (
                <div key={featureKey} className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  <span>{t(featureKey)}</span>
                </div>
              ))}
            </div>
            <Button
              className="mt-8 w-full"
              variant={plan.highlight ? "secondary" : "outline"}
              disabled={isProcessing === plan.id}
              onClick={() => handleChoosePlan(plan.priceId, plan.id)}
            >
              {isProcessing === plan.id
                ? t("billing.processing")
                : plan.id === "agency"
                  ? t("billing.contactSales")
                  : t("billing.choosePlan")}
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-2xl font-semibold">
          {t("billing.enterprise.title")}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("billing.enterprise.subtitle")}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/40 p-4">
            <h3 className="text-sm font-semibold">
              {t("billing.enterprise.collabTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("billing.enterprise.collabDesc")}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <h3 className="text-sm font-semibold">
              {t("billing.enterprise.opsTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("billing.enterprise.opsDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
