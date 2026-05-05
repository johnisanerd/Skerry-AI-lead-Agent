import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  Users,
  Eye,
  MousePointer,
  Calendar,
  Download,
  Filter,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useLanguageStore, useT } from "@/lib/i18n";

interface CampaignMetrics {
  id: string;
  name: string;
  status: "active" | "paused" | "completed";
  totalLeads: number;
  sentEmails: number;
  deliveredEmails: number;
  openedEmails: number;
  clickedEmails: number;
  repliedEmails: number;
  unsubscribedEmails: number;
  bouncedEmails: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  unsubscribeRate: number;
  bounceRate: number;
  deliveryRate: number;
  revenue: number;
  cost: number;
  roi: number;
  startDate: string;
  endDate?: string;
  lastActivity: string;
}

interface TimeSeriesData {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  revenue: number;
}

interface TopPerformingEmail {
  id: string;
  subject: string;
  openRate: number;
  clickRate: number;
  replyRate: number;
  sentCount: number;
}

export function CampaignAnalytics() {
  const t = useT();
  const language = useLanguageStore(s => s.language);
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [selectedCampaign, setSelectedCampaign] =
    useState<CampaignMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [topEmails, setTopEmails] = useState<TopPerformingEmail[]>([]);
  const [dateRange, setDateRange] = useState<string>("30d");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignAnalytics(selectedCampaign.id);
    }
  }, [selectedCampaign, dateRange]);

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/campaigns/analytics", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setCampaigns(data.campaigns);
        if (data.campaigns.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data.campaigns[0]);
        }
      }
    } catch (err) {
      toast.error(t("analytics.loadError"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaignAnalytics = async (campaignId: string) => {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/analytics?range=${dateRange}`,
        {
          credentials: "include",
        }
      );
      const data = await res.json();
      if (data.ok) {
        setTimeSeriesData(data.timeSeries);
        setTopEmails(data.topEmails);
      }
    } catch (err) {
      toast.error(t("analytics.loadError"));
    }
  };

  const exportAnalytics = async () => {
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign?.id}/export`, {
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `campaign-analytics-${selectedCampaign?.name}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(t("analytics.exported"));
      }
    } catch (err) {
      toast.error(t("analytics.exportError"));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      paused: "outline",
      completed: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getRateColor = (rate: number, type: "positive" | "negative") => {
    if (type === "positive") {
      if (rate >= 50) return "text-green-600";
      if (rate >= 25) return "text-yellow-600";
      return "text-red-600";
    } else {
      if (rate <= 2) return "text-green-600";
      if (rate <= 5) return "text-yellow-600";
      return "text-red-600";
    }
  };

  const formatCurrency = (amount: number) => {
    const locale = language === "de" ? "de-DE" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Campaign Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t("analytics.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Select
                value={selectedCampaign?.id}
                onValueChange={value => {
                  const campaign = campaigns.find(c => c.id === value);
                  setSelectedCampaign(campaign || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("analytics.selectCampaign")} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">{t("analytics.last7Days")}</SelectItem>
                  <SelectItem value="30d">
                    {t("analytics.last30Days")}
                  </SelectItem>
                  <SelectItem value="90d">
                    {t("analytics.last90Days")}
                  </SelectItem>
                  <SelectItem value="custom">
                    {t("analytics.customRange")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={exportAnalytics}
              disabled={!selectedCampaign}
            >
              <Download className="w-4 h-4 mr-2" />
              {t("analytics.export")}
            </Button>
          </div>

          {/* Campaign List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map(campaign => (
              <Card
                key={campaign.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  selectedCampaign?.id === campaign.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => setSelectedCampaign(campaign)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{campaign.name}</h4>
                    {getStatusBadge(campaign.status)}
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        {t("analytics.leads")}:
                      </span>
                      <span className="font-medium">{campaign.totalLeads}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("analytics.sent")}:
                      </span>
                      <span className="font-medium">{campaign.sentEmails}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("analytics.openRate")}:
                      </span>
                      <span
                        className={`font-medium ${getRateColor(campaign.openRate, "positive")}`}
                      >
                        {campaign.openRate}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("analytics.replyRate")}:
                      </span>
                      <span
                        className={`font-medium ${getRateColor(campaign.replyRate, "positive")}`}
                      >
                        {campaign.replyRate}%
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mt-2">
                    {t("analytics.lastActivity")}:{" "}
                    {new Date(campaign.lastActivity).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      {selectedCampaign && (
        <>
          {/* Overview Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {t("analytics.overview")} - {selectedCampaign.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded">
                  <div className="font-semibold text-lg">
                    {selectedCampaign.totalLeads}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.totalLeads")}
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded">
                  <div className="font-semibold text-lg text-blue-700">
                    {selectedCampaign.sentEmails}
                  </div>
                  <div className="text-sm text-blue-600">
                    {t("analytics.sentEmails")}
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded">
                  <div className="font-semibold text-lg text-green-700">
                    {selectedCampaign.openedEmails}
                  </div>
                  <div className="text-sm text-green-600">
                    {t("analytics.openedEmails")}
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <div className="font-semibold text-lg text-purple-700">
                    {selectedCampaign.repliedEmails}
                  </div>
                  <div className="text-sm text-purple-600">
                    {t("analytics.repliedEmails")}
                  </div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded">
                  <div className="font-semibold text-lg text-yellow-700">
                    {selectedCampaign.clickedEmails}
                  </div>
                  <div className="text-sm text-yellow-600">
                    {t("analytics.clickedEmails")}
                  </div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded">
                  <div className="font-semibold text-lg text-red-700">
                    {selectedCampaign.unsubscribedEmails}
                  </div>
                  <div className="text-sm text-red-600">
                    {t("analytics.unsubscribedEmails")}
                  </div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded">
                  <div className="font-semibold text-lg text-orange-700">
                    {selectedCampaign.bouncedEmails}
                  </div>
                  <div className="text-sm text-orange-600">
                    {t("analytics.bouncedEmails")}
                  </div>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded">
                  <div className="font-semibold text-lg text-emerald-700">
                    {formatCurrency(selectedCampaign.revenue)}
                  </div>
                  <div className="text-sm text-emerald-600">
                    {t("analytics.revenue")}
                  </div>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded">
                  <div className="font-semibold text-lg text-indigo-700">
                    {formatCurrency(selectedCampaign.cost)}
                  </div>
                  <div className="text-sm text-indigo-600">
                    {t("analytics.cost")}
                  </div>
                </div>
              </div>

              {/* Performance Rates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="text-center p-4 bg-muted rounded">
                  <div
                    className={`font-semibold text-lg ${getRateColor(selectedCampaign.openRate, "positive")}`}
                  >
                    {selectedCampaign.openRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.openRate")}
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded">
                  <div
                    className={`font-semibold text-lg ${getRateColor(selectedCampaign.clickRate, "positive")}`}
                  >
                    {selectedCampaign.clickRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.clickRate")}
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded">
                  <div
                    className={`font-semibold text-lg ${getRateColor(selectedCampaign.replyRate, "positive")}`}
                  >
                    {selectedCampaign.replyRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.replyRate")}
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded">
                  <div
                    className={`font-semibold text-lg ${getRateColor(selectedCampaign.unsubscribeRate, "negative")}`}
                  >
                    {selectedCampaign.unsubscribeRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.unsubscribeRate")}
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded">
                  <div
                    className={`font-semibold text-lg ${getRateColor(selectedCampaign.bounceRate, "negative")}`}
                  >
                    {selectedCampaign.bounceRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.bounceRate")}
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded">
                  <div className="font-semibold text-lg text-green-600">
                    {selectedCampaign.deliveryRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.deliveryRate")}
                  </div>
                </div>
                <div className="text-center p-4 bg-muted rounded">
                  <div
                    className={`font-semibold text-lg ${selectedCampaign.roi >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {selectedCampaign.roi}x
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.roi")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Series Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {t("analytics.performanceOverTime")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Simple Chart Representation */}
                <div className="space-y-3">
                  {timeSeriesData.map((data, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {new Date(data.date).toLocaleDateString()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(data.revenue)}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{data.sent}</div>
                          <div className="text-muted-foreground">
                            {t("analytics.sent")}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{data.opened}</div>
                          <div className="text-muted-foreground">
                            {t("analytics.opened")}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{data.clicked}</div>
                          <div className="text-muted-foreground">
                            {t("analytics.clicked")}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{data.replied}</div>
                          <div className="text-muted-foreground">
                            {t("analytics.replied")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Performing Emails */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                {t("analytics.topEmails")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topEmails.map((email, index) => (
                  <Card key={email.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">{email.subject}</h4>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              {t("analytics.openRate")}:
                            </span>
                            <span
                              className={`font-medium ${getRateColor(email.openRate, "positive")}`}
                            >
                              {email.openRate}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t("analytics.clickRate")}:
                            </span>
                            <span
                              className={`font-medium ${getRateColor(email.clickRate, "positive")}`}
                            >
                              {email.clickRate}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t("analytics.replyRate")}:
                            </span>
                            <span
                              className={`font-medium ${getRateColor(email.replyRate, "positive")}`}
                            >
                              {email.replyRate}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t("analytics.sent")}:
                            </span>
                            <span className="font-medium">
                              {email.sentCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {topEmails.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t("analytics.noTopEmails")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* No Campaigns State */}
      {!selectedCampaign && campaigns.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {t("analytics.noCampaigns")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
