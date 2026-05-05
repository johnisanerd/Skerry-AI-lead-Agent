import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Download,
  Upload,
  X,
  Check,
  AlertTriangle,
  Users,
  Mail,
  Ban,
  Trash2,
  Eye,
  Globe,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface SuppressionRule {
  id: string;
  name: string;
  type: "email" | "domain" | "company" | "pattern";
  value: string;
  reason: string;
  isActive: boolean;
  createdAt: string;
  matchCount: number;
}

interface DuplicateGroup {
  id: string;
  name: string;
  leads: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    company: string;
    confidenceScore: number;
    source: string;
    createdAt: string;
  }>;
  status: "pending" | "resolved" | "ignored";
  action: "keep_primary" | "merge" | "delete_all" | "delete_duplicates";
  createdAt: string;
}

export function DeduplicationManager() {
  const t = useT();
  const [suppressionRules, setSuppressionRules] = useState<SuppressionRule[]>(
    []
  );
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    type: "email" as const,
    value: "",
    reason: "",
  });

  useEffect(() => {
    loadSuppressionRules();
    loadDuplicateGroups();
  }, []);

  const loadSuppressionRules = async () => {
    try {
      const res = await fetch("/api/suppression-rules", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setSuppressionRules(data.rules);
      }
    } catch (err) {
      toast.error(t("dedup.loadError"));
    }
  };

  const loadDuplicateGroups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/duplicate-groups", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setDuplicateGroups(data.groups);
      }
    } catch (err) {
      toast.error(t("dedup.loadError"));
    } finally {
      setIsLoading(false);
    }
  };

  const addSuppressionRule = async () => {
    if (
      !newRule.name.trim() ||
      !newRule.value.trim() ||
      !newRule.reason.trim()
    ) {
      toast.error(t("dedup.ruleRequired"));
      return;
    }

    setIsAddingRule(true);
    try {
      const res = await fetch("/api/suppression-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newRule),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("dedup.ruleCreated"));
        setNewRule({ name: "", type: "email", value: "", reason: "" });
        loadSuppressionRules();
      } else {
        toast.error(data.error || t("dedup.createError"));
      }
    } catch (err) {
      toast.error(t("dedup.createError"));
    } finally {
      setIsAddingRule(false);
    }
  };

  const toggleRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/suppression-rules/${ruleId}/toggle`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("dedup.ruleUpdated"));
        loadSuppressionRules();
      } else {
        toast.error(data.error || t("dedup.updateError"));
      }
    } catch (err) {
      toast.error(t("dedup.updateError"));
    }
  };

  const resolveDuplicateGroup = async (groupId: string, action: string) => {
    try {
      const res = await fetch(`/api/duplicate-groups/${groupId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("dedup.groupResolved"));
        loadDuplicateGroups();
        setSelectedGroup(null);
      } else {
        toast.error(data.error || t("dedup.resolveError"));
      }
    } catch (err) {
      toast.error(t("dedup.resolveError"));
    }
  };

  const exportSuppressionRules = async () => {
    try {
      const res = await fetch("/api/suppression-rules/export", {
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "suppression-rules.csv";
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(t("dedup.exported"));
      }
    } catch (err) {
      toast.error(t("dedup.exportError"));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      resolved: "default",
      ignored: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      email: Mail,
      domain: Globe,
      company: Users,
      pattern: Filter,
    } as const;

    return icons[type as keyof typeof icons] || Mail;
  };

  const filteredRules = suppressionRules.filter(rule => {
    const matchesSearch =
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || rule.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredGroups = duplicateGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Suppression Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5" />
            {t("dedup.suppressionRules")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Rule */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-3">{t("dedup.addRule")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="rule-name">{t("dedup.ruleName")}</Label>
                <Input
                  id="rule-name"
                  placeholder={t("dedup.ruleNamePlaceholder")}
                  value={newRule.name}
                  onChange={e =>
                    setNewRule(prev => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="rule-type">{t("dedup.ruleType")}</Label>
                <Select
                  value={newRule.type}
                  onValueChange={(value: any) =>
                    setNewRule(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      {t("dedup.type.email")}
                    </SelectItem>
                    <SelectItem value="domain">
                      {t("dedup.type.domain")}
                    </SelectItem>
                    <SelectItem value="company">
                      {t("dedup.type.company")}
                    </SelectItem>
                    <SelectItem value="pattern">
                      {t("dedup.type.pattern")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rule-value">{t("dedup.ruleValue")}</Label>
                <Input
                  id="rule-value"
                  placeholder={t("dedup.ruleValuePlaceholder")}
                  value={newRule.value}
                  onChange={e =>
                    setNewRule(prev => ({ ...prev, value: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="rule-reason">{t("dedup.ruleReason")}</Label>
                <Textarea
                  id="rule-reason"
                  placeholder={t("dedup.ruleReasonPlaceholder")}
                  value={newRule.reason}
                  onChange={e =>
                    setNewRule(prev => ({ ...prev, reason: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addSuppressionRule} disabled={isAddingRule}>
                <Check className="w-4 h-4 mr-2" />
                {isAddingRule ? t("common.creating") : t("dedup.addRule")}
              </Button>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("dedup.searchRules")}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("dedup.filterByType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    <SelectItem value="email">
                      {t("dedup.type.email")}
                    </SelectItem>
                    <SelectItem value="domain">
                      {t("dedup.type.domain")}
                    </SelectItem>
                    <SelectItem value="company">
                      {t("dedup.type.company")}
                    </SelectItem>
                    <SelectItem value="pattern">
                      {t("dedup.type.pattern")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={exportSuppressionRules}>
                <Download className="w-4 h-4 mr-2" />
                {t("dedup.exportRules")}
              </Button>
            </div>

            {filteredRules.map(rule => (
              <Card key={rule.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(getTypeIcon(rule.type), {
                        className: "w-4 h-4",
                      })}
                      <h4 className="font-semibold">{rule.name}</h4>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive
                          ? t("common.active")
                          : t("common.inactive")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          {t("dedup.type")}:
                        </span>
                        <span className="font-medium">
                          {t(`dedup.type.${rule.type}`)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t("dedup.value")}:
                        </span>
                        <span className="font-medium">{rule.value}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>{t("dedup.reason")}:</strong> {rule.reason}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("dedup.matchCount")}: {rule.matchCount} •{" "}
                      {t("dedup.createdAt")}:{" "}
                      {new Date(rule.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRule(rule.id)}
                    >
                      {rule.isActive
                        ? t("common.deactivate")
                        : t("common.activate")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("dedup.confirmDelete"))) {
                          // Delete rule logic here
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredRules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Ban className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("dedup.noRules")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Groups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {t("dedup.duplicateGroups")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("dedup.searchGroups")}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Groups List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">
                  {t("common.loading")}
                </p>
              </div>
            ) : (
              filteredGroups.map(group => (
                <Card key={group.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{group.name}</h4>
                        {getStatusBadge(group.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("dedup.duplicateCount")}: {group.leads.length} •{" "}
                        {t("dedup.createdAt")}:{" "}
                        {new Date(group.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedGroup(group)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {t("common.view")}
                    </Button>
                  </div>

                  {/* Duplicate Leads Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.leads.slice(0, 4).map((lead, index) => (
                      <div key={lead.id} className="p-3 border rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {lead.firstName} {lead.lastName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            •
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {lead.company}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lead.email} • {t("dedup.confidence")}:{" "}
                          {lead.confidenceScore}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  {group.status === "pending" && (
                    <div className="flex gap-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          resolveDuplicateGroup(group.id, "keep_primary")
                        }
                      >
                        {t("dedup.keepPrimary")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveDuplicateGroup(group.id, "merge")}
                      >
                        {t("dedup.merge")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          resolveDuplicateGroup(group.id, "delete_duplicates")
                        }
                      >
                        {t("dedup.deleteDuplicates")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          resolveDuplicateGroup(group.id, "delete_all")
                        }
                      >
                        {t("dedup.deleteAll")}
                      </Button>
                    </div>
                  )}
                </Card>
              ))
            )}

            {filteredGroups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("dedup.noDuplicates")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Group Detail Modal */}
      {selectedGroup && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t("dedup.groupDetails")} - {selectedGroup.name}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedGroup(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-96 overflow-y-auto">
                {selectedGroup.leads.map(lead => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-4 p-3 border-b"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lead.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lead.company}
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="text-muted-foreground">
                        {t("dedup.confidence")}: {lead.confidenceScore}%
                      </div>
                      <div className="text-muted-foreground">
                        {t("dedup.source")}: {lead.source}
                      </div>
                      <div className="text-muted-foreground">
                        {t("dedup.createdAt")}:{" "}
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              {selectedGroup.status === "pending" && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() =>
                      resolveDuplicateGroup(selectedGroup.id, "keep_primary")
                    }
                    className="flex-1"
                  >
                    {t("dedup.keepPrimary")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      resolveDuplicateGroup(selectedGroup.id, "merge")
                    }
                    className="flex-1"
                  >
                    {t("dedup.merge")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      resolveDuplicateGroup(
                        selectedGroup.id,
                        "delete_duplicates"
                      )
                    }
                    className="flex-1"
                  >
                    {t("dedup.deleteDuplicates")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      resolveDuplicateGroup(selectedGroup.id, "delete_all")
                    }
                    className="flex-1"
                  >
                    {t("dedup.deleteAll")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </Card>
      )}
    </div>
  );
}
