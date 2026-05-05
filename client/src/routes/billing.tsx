import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
});

const billingPlans = [
  {
    title: "Solo",
    price: "$29",
    priceId: "price_solo_placeholder", // Will be replaced with actual Stripe price ID
    description: "Best for independent founders and freelancers.",
    features: [
      "Up to 200 leads / month",
      "Basic lead research pipeline",
      "Email generation and verification",
      "Self-service onboarding",
    ],
    highlight: false,
  },
  {
    title: "Team",
    price: "$79",
    priceId: "price_team_placeholder", // Will be replaced with actual Stripe price ID
    description: "Designed for small teams with collaborative lead workflows.",
    features: [
      "Up to 1,000 leads / month",
      "Advanced research and lead qualification",
      "Shared pipeline and workspace view",
      "Priority AI processing",
    ],
    highlight: true,
  },
  {
    title: "Agency",
    price: "$199",
    priceId: "price_agency_placeholder", // Will be replaced with actual Stripe price ID
    description: "Enterprise-grade workspace for agencies and consultancies.",
    features: [
      "Unlimited team seats",
      "Agency lead score and export workflows",
      "Dedicated account review",
      "Custom onboarding and support",
    ],
    highlight: false,
  },
];

function BillingPage() {
  const { currentId } = useWorkspaceStore();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleChoosePlan = async (priceId: string, planTitle: string) => {
    if (planTitle === "Agency") {
      toast.info("Für Agency-Plan kontaktieren Sie bitte unseren Sales-Team.");
      return;
    }

    setIsProcessing(planTitle);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          priceId,
          workspaceId: currentId 
        }),
      });
      const data = await res.json();
      
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      
      if (data.code === 'STRIPE_NOT_CONFIGURED') {
        toast.info('Billing kommt bald — danke für dein Interesse!');
        return;
      }
      
      toast.error(data.message ?? 'Fehler beim Checkout');
    } catch (err) {
      toast.error('Verbindung zum Server fehlgeschlagen');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Billing &amp; Plans</h1>
        <p className="max-w-3xl text-white/70">
          Manage your subscription, review plan features, and choose the right
          tier for your growth stage. Enterprise and agency plans include
          dedicated support, shared workspaces, and higher usage quotas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {billingPlans.map(plan => (
          <div
            key={plan.title}
            className={`rounded-3xl border p-6 shadow-sm transition ${plan.highlight ? "border-cyan-500/30 bg-cyan-500/5 shadow-cyan-500/10" : "border-white/10 bg-white/5"}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">{plan.title}</h3>
                <p className="mt-2 text-sm text-white/60">{plan.description}</p>
              </div>
              <span className="text-3xl font-bold">{plan.price}</span>
            </div>
            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              {plan.features.map(feature => (
                <div key={feature} className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <Button 
              className="mt-8 w-full" 
              variant={plan.highlight ? "secondary" : "outline"}
              disabled={isProcessing === plan.title}
              onClick={() => handleChoosePlan(plan.priceId, plan.title)}
            >
              {isProcessing === plan.title ? "Wird verarbeitet..." : 
               plan.title === "Agency" ? "Contact Sales" : "Choose plan"}
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold">Enterprise Ready</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          For agency and enterprise customers, Skerry provides enhanced
          lead-generation throughput, team-based workspaces, and premium
          onboarding support. Your billing configuration can include flexible
          usage allowances, contractual terms, and dedicated account management.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/5 p-4">
            <h3 className="text-sm font-semibold">Team Collaboration</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add teammates, share research results, and centralize lead
              generation across your organization.
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <h3 className="text-sm font-semibold">Agency Operations</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage multiple client pipelines, export shortlisted leads, and
              onboard accounts with premium support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
