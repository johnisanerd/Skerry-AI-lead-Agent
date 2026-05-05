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
  Globe,
  Database,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  Plus,
  BarChart3,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface LeadSource {
  id: string;
  name: string;
  type: "api" | "manual" | "import" | "webhook";
  status: "active" | "inactive" | "error";
  confidenceScore: number;
  leadCount: number;
  validLeadCount: number;
  lastSync: string;
  settings: {
    apiKey?: string;
    syncInterval?: number;
    webhookUrl?: string;
    fields?: string[];
  };
}

interface Lead {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  confidenceScore: number;
  source: string;
  status: "valid" | "invalid" | "duplicate" | "suppressed";
  createdAt: string;
}

export function LeadSources() {
  const t = useT();
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<LeadSource | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<
    "api" | "manual" | "import" | "webhook"
  >("api");

  useEffect(() => {
    loadSources();
    loadRecentLeads();
  }, []);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/lead-sources", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setSources(data.sources);
      } else {
        toast.error(data.error || t("sources.loadError"));
      }
    } catch (err) {
      toast.error(t("sources.loadError"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentLeads = async () => {
    try {
      const res = await fetch("/api/leads/recent", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setRecentLeads(data.leads);
      }
    } catch (err) {
      console.error("Failed to load recent leads:", err);
    }
  };

  const addSource = async () => {
    if (!newSourceName.trim()) {
      toast.error(t("sources.nameRequired"));
      return;
    }

    setIsAddingSource(true);
    try {
      const res = await fetch("/api/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newSourceName,
          type: newSourceType,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("sources.created"));
        setNewSourceName("");
        setNewSourceType("api");
        loadSources();
      } else {
        toast.error(data.error || t("sources.createError"));
      }
    } catch (err) {
      toast.error(t("sources.createError"));
    } finally {
      setIsAddingSource(false);
    }
  };

  const syncSource = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/lead-sources/${sourceId}/sync`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("sources.syncStarted"));
        loadSources();
      } else {
        toast.error(data.error || t("sources.syncError"));
      }
    } catch (err) {
      toast.error(t("sources.syncError"));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      error: "destructive",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      api: Database,
      manual: Plus,
      import: Globe,
      webhook: Settings,
    } as const;

    return icons[type as keyof typeof icons] || Database;
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getLeadStatusBadge = (status: string) => {
    const variants = {
      valid: "default",
      invalid: "destructive",
      duplicate: "secondary",
      suppressed: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`leadStatus.${status}`)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Lead Sources Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            {t("sources.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Source */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="source-name">{t("sources.name")}</Label>
              <Input
                id="source-name"
                placeholder={t("sources.namePlaceholder")}
                value={newSourceName}
                onChange={e => setNewSourceName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="source-type">{t("sources.type")}</Label>
              <Select
                value={newSourceType}
                onValueChange={value => setNewSourceType(value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">{t("sources.type.api")}</SelectItem>
                  <SelectItem value="manual">
                    {t("sources.type.manual")}
                  </SelectItem>
                  <SelectItem value="import">
                    {t("sources.type.import")}
                  </SelectItem>
                  <SelectItem value="webhook">
                    {t("sources.type.webhook")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addSource} disabled={isAddingSource}>
              <Plus className="w-4 h-4 mr-2" />
              {isAddingSource ? t("common.creating") : t("sources.add")}
            </Button>
          </div>

          {/* Sources List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sources.map(source => (
              <Card key={source.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {React.createElement(getTypeIcon(source.type), {
                      className: "w-4 h-4",
                    })}
                    <h4 className="font-semibold">{source.name}</h4>
                  </div>
                  {getStatusBadge(source.status)}
                </div>

                {/* Source Stats */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("sources.confidenceScore")}:
                    </span>
                    <span
                      className={`font-medium ${getConfidenceColor(source.confidenceScore)}`}
                    >
                      {source.confidenceScore}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("sources.totalLeads")}:
                    </span>
                    <span className="font-medium">{source.leadCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("sources.validLeads")}:
                    </span>
                    <span className="font-medium">{source.validLeadCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("sources.lastSync")}:
                    </span>
                    <span className="font-medium">
                      {new Date(source.lastSync).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSource(source)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    {t("common.settings")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncSource(source.id)}
                    disabled={source.status === "error"}
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    {t("sources.sync")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {sources.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("sources.noSources")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Leads with Confidence Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {t("sources.recentLeads")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Confidence Score Distribution */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">
              {t("sources.confidenceDistribution")}
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="font-semibold text-lg text-green-700">
                  {recentLeads.filter(l => l.confidenceScore >= 80).length}
                </div>
                <div className="text-sm text-green-600">
                  {t("sources.high")}
                </div>
                <div className="text-xs text-green-500">(80-100%)</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded">
                <div className="font-semibold text-lg text-yellow-700">
                  {
                    recentLeads.filter(
                      l => l.confidenceScore >= 60 && l.confidenceScore < 80
                    ).length
                  }
                </div>
                <div className="text-sm text-yellow-600">
                  {t("sources.medium")}
                </div>
                <div className="text-xs text-yellow-500">(60-79%)</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="font-semibold text-lg text-orange-700">
                  {
                    recentLeads.filter(
                      l => l.confidenceScore >= 40 && l.confidenceScore < 60
                    ).length
                  }
                </div>
                <div className="text-sm text-orange-600">
                  {t("sources.low")}
                </div>
                <div className="text-xs text-orange-500">(40-59%)</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="font-semibold text-lg text-red-700">
                  {recentLeads.filter(l => l.confidenceScore < 40).length}
                </div>
                <div className="text-sm text-red-600">
                  {t("sources.veryLow")}
                </div>
                <div className="text-xs text-red-500">(0-39%)</div>
              </div>
            </div>
          </div>

          {/* Recent Leads List */}
          <div className="space-y-3">
            {recentLeads.slice(0, 10).map(lead => (
              <Card key={lead.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">
                        {lead.firstName} {lead.lastName}
                      </h4>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {lead.company}
                      </span>
                      {getLeadStatusBadge(lead.status)}
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">
                      {lead.email}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        {t("sources.confidence")}:
                        <span
                          className={`font-medium ${getConfidenceColor(lead.confidenceScore)}`}
                        >
                          {lead.confidenceScore}%
                        </span>
                      </span>
                      <span>
                        {t("sources.source")}: {lead.source}
                      </span>
                      <span>
                        {t("sources.createdAt")}:{" "}
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Progress value={lead.confidenceScore} className="w-16" />
                    <div className="text-xs text-muted-foreground mt-1 text-center">
                      {lead.confidenceScore}%
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {recentLeads.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("sources.noRecentLeads")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
