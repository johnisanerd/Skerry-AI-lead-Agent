import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Mail,
  Target,
  Zap,
  Shield,
  Crown,
  Package,
  Download,
  RefreshCw,
  Settings,
  Eye,
  Calendar,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface Subscription {
  id: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

interface UsageMetrics {
  leads: {
    used: number;
    limit: number;
    resetDate: string;
  };
  emails: {
    sent: number;
    limit: number;
    resetDate: string;
  };
  campaigns: {
    active: number;
    limit: number;
  };
  workspaces: {
    used: number;
    limit: number;
  };
  storage: {
    used: number;
    limit: number;
  };
  apiCalls: {
    used: number;
    limit: number;
    resetDate: string;
  };
}

interface BillingHistory {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: "succeeded" | "failed" | "pending" | "refunded";
  description: string;
  invoiceUrl?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  limits: {
    leads: number;
    emails: number;
    campaigns: number;
    workspaces: number;
    storage: number;
    apiCalls: number;
  };
  popular?: boolean;
}

export function BillingManager() {
  const t = useT();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      const [subRes, usageRes, historyRes, plansRes] = await Promise.all([
        fetch("/api/billing/subscription", { credentials: "include" }),
        fetch("/api/billing/usage", { credentials: "include" }),
        fetch("/api/billing/history", { credentials: "include" }),
        fetch("/api/billing/plans", { credentials: "include" }),
      ]);

      const [subData, usageData, historyData, plansData] = await Promise.all([
        subRes.json(),
        usageRes.json(),
        historyRes.json(),
        plansRes.json(),
      ]);

      if (subData.ok) setSubscription(subData.subscription);
      if (usageData.ok) setUsage(usageData.usage);
      if (historyData.ok) setBillingHistory(historyData.history);
      if (plansData.ok) setAvailablePlans(plansData.plans);
    } catch (err) {
      toast.error(t("billing.loadError"));
    } finally {
      setIsLoading(false);
    }
  };

  const upgradePlan = async (planId: string) => {
    setIsUpgrading(true);
    try {
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("billing.upgradeSuccess"));
        loadBillingData();
      } else {
        toast.error(data.error || t("billing.upgradeError"));
      }
    } catch (err) {
      toast.error(t("billing.upgradeError"));
    } finally {
      setIsUpgrading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!confirm(t("billing.confirmCancel"))) {
      return;
    }

    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("billing.cancelSuccess"));
        loadBillingData();
      } else {
        toast.error(data.error || t("billing.cancelError"));
      }
    } catch (err) {
      toast.error(t("billing.cancelError"));
    }
  };

  const reactivateSubscription = async () => {
    try {
      const res = await fetch("/api/billing/reactivate", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("billing.reactivateSuccess"));
        loadBillingData();
      } else {
        toast.error(data.error || t("billing.reactivateError"));
      }
    } catch (err) {
      toast.error(t("billing.reactivateError"));
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/billing/invoice/${invoiceId}`, {
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        const blob = new Blob([data.pdf], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(t("billing.invoiceDownloaded"));
      }
    } catch (err) {
      toast.error(t("billing.invoiceDownloadError"));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      trialing: "secondary",
      past_due: "destructive",
      canceled: "outline",
      unpaid: "destructive",
      succeeded: "default",
      failed: "destructive",
      pending: "secondary",
      refunded: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getPlanIcon = (plan: string) => {
    const icons = {
      free: Package,
      starter: Zap,
      pro: Crown,
      enterprise: Shield,
    } as const;

    return icons[plan as keyof typeof icons] || Package;
  };

  const getUsageColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-yellow-600";
    return "text-green-600";
  };

  const formatBytes = (bytes: number) => {
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    const sizeStr = size.toFixed(2) + " " + sizes[i];

    return sizeStr;
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {t("billing.currentSubscription")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {React.createElement(getPlanIcon(subscription.plan), {
                  className: "w-8 h-8",
                })}
                <div>
                  <h3 className="text-xl font-semibold capitalize">
                    {subscription.plan}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(subscription.status)}
                    {subscription.cancelAtPeriodEnd && (
                      <Badge variant="outline" className="text-orange-600">
                        {t("billing.cancelsAtPeriodEnd")}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  {t("billing.currentPeriod")}:{" "}
                  {new Date(
                    subscription.currentPeriodStart
                  ).toLocaleDateString()}{" "}
                  -{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </div>
                {subscription.trialEnd && (
                  <div className="text-sm text-muted-foreground">
                    {t("billing.trialEnds")}:{" "}
                    {new Date(subscription.trialEnd).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              {subscription.status === "active" &&
                !subscription.cancelAtPeriodEnd && (
                  <Button variant="outline" onClick={cancelSubscription}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {t("billing.cancelSubscription")}
                  </Button>
                )}
              {subscription.cancelAtPeriodEnd && (
                <Button onClick={reactivateSubscription}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t("billing.reactivateSubscription")}
                </Button>
              )}
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                {t("billing.managePayment")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Metrics */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t("billing.usageMetrics")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Leads */}
              <div className="p-4 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{t("billing.leads")}</span>
                  </div>
                  <span
                    className={`font-medium ${getUsageColor(usage.leads.used, usage.leads.limit)}`}
                  >
                    {usage.leads.used} / {usage.leads.limit}
                  </span>
                </div>
                <Progress
                  value={(usage.leads.used / usage.leads.limit) * 100}
                  className="mb-2"
                />
                <div className="text-xs text-muted-foreground">
                  {t("billing.resetsOn")}:{" "}
                  {new Date(usage.leads.resetDate).toLocaleDateString()}
                </div>
              </div>

              {/* Emails */}
              <div className="p-4 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="font-medium">{t("billing.emails")}</span>
                  </div>
                  <span
                    className={`font-medium ${getUsageColor(usage.emails.sent, usage.emails.limit)}`}
                  >
                    {usage.emails.sent} / {usage.emails.limit}
                  </span>
                </div>
                <Progress
                  value={(usage.emails.sent / usage.emails.limit) * 100}
                  className="mb-2"
                />
                <div className="text-xs text-muted-foreground">
                  {t("billing.resetsOn")}:{" "}
                  {new Date(usage.emails.resetDate).toLocaleDateString()}
                </div>
              </div>

              {/* Campaigns */}
              <div className="p-4 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span className="font-medium">
                      {t("billing.campaigns")}
                    </span>
                  </div>
                  <span
                    className={`font-medium ${getUsageColor(usage.campaigns.active, usage.campaigns.limit)}`}
                  >
                    {usage.campaigns.active} / {usage.campaigns.limit}
                  </span>
                </div>
                <Progress
                  value={(usage.campaigns.active / usage.campaigns.limit) * 100}
                  className="mb-2"
                />
              </div>

              {/* Workspaces */}
              <div className="p-4 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span className="font-medium">
                      {t("billing.workspaces")}
                    </span>
                  </div>
                  <span
                    className={`font-medium ${getUsageColor(usage.workspaces.used, usage.workspaces.limit)}`}
                  >
                    {usage.workspaces.used} / {usage.workspaces.limit}
                  </span>
                </div>
                <Progress
                  value={(usage.workspaces.used / usage.workspaces.limit) * 100}
                  className="mb-2"
                />
              </div>

              {/* Storage */}
              <div className="p-4 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span className="font-medium">{t("billing.storage")}</span>
                  </div>
                  <span
                    className={`font-medium ${getUsageColor(usage.storage.used, usage.storage.limit)}`}
                  >
                    {formatBytes(usage.storage.used)} /{" "}
                    {formatBytes(usage.storage.limit)}
                  </span>
                </div>
                <Progress
                  value={(usage.storage.used / usage.storage.limit) * 100}
                  className="mb-2"
                />
              </div>

              {/* API Calls */}
              <div className="p-4 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span className="font-medium">{t("billing.apiCalls")}</span>
                  </div>
                  <span
                    className={`font-medium ${getUsageColor(usage.apiCalls.used, usage.apiCalls.limit)}`}
                  >
                    {usage.apiCalls.used} / {usage.apiCalls.limit}
                  </span>
                </div>
                <Progress
                  value={(usage.apiCalls.used / usage.apiCalls.limit) * 100}
                  className="mb-2"
                />
                <div className="text-xs text-muted-foreground">
                  {t("billing.resetsOn")}:{" "}
                  {new Date(usage.apiCalls.resetDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            {t("billing.availablePlans")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {availablePlans.map(plan => (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "ring-2 ring-primary" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      {t("billing.popular")}
                    </Badge>
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="text-center mb-4">
                    <div className="flex justify-center mb-2">
                      {React.createElement(getPlanIcon(plan.id), {
                        className: "w-8 h-8",
                      })}
                    </div>
                    <h3 className="font-semibold text-lg capitalize">
                      {plan.name}
                    </h3>
                    <div className="text-2xl font-bold mt-2">
                      {formatCurrency(plan.price)}
                      <span className="text-sm text-muted-foreground">
                        /{t(`billing.interval.${plan.interval}`)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {plan.features.map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 mb-4 text-sm text-muted-foreground">
                    <div>
                      {t("billing.limits.leads")}: {plan.limits.leads}
                    </div>
                    <div>
                      {t("billing.limits.emails")}: {plan.limits.emails}
                    </div>
                    <div>
                      {t("billing.limits.campaigns")}: {plan.limits.campaigns}
                    </div>
                    <div>
                      {t("billing.limits.workspaces")}: {plan.limits.workspaces}
                    </div>
                    <div>
                      {t("billing.limits.storage")}:{" "}
                      {formatBytes(plan.limits.storage)}
                    </div>
                    <div>
                      {t("billing.limits.apiCalls")}: {plan.limits.apiCalls}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => upgradePlan(plan.id)}
                    disabled={isUpgrading || subscription?.plan === plan.id}
                  >
                    {isUpgrading
                      ? t("billing.upgrading")
                      : subscription?.plan === plan.id
                        ? t("billing.currentPlan")
                        : t("billing.upgrade")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t("billing.billingHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {billingHistory.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{item.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(item.amount, item.currency)}
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                  {item.invoiceUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadInvoice(item.id)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      {t("billing.download")}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {billingHistory.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("billing.noHistory")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
