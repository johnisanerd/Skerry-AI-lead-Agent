import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import {
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Download,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface Lead {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "in_review"
    | "needs_clarification";
  confidenceScore: number;
  source: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewNotes?: string;
  riskLevel: "low" | "medium" | "high";
}

export function ReviewQueue() {
  const t = useT();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(
        lead =>
          lead.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    if (riskFilter !== "all") {
      filtered = filtered.filter(lead => lead.riskLevel === riskFilter);
    }

    setFilteredLeads(filtered);
  }, [leads, searchTerm, statusFilter, riskFilter]);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/leads/review-queue", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setLeads(data.leads);
      } else {
        toast.error(data.error || t("review.loadError"));
      }
    } catch (err) {
      toast.error(t("review.loadError"));
    } finally {
      setIsLoading(false);
    }
  };

  const approveLead = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("review.leadApproved"));
        loadLeads();
        setSelectedLead(null);
      } else {
        toast.error(data.error || t("review.approveError"));
      }
    } catch (err) {
      toast.error(t("review.approveError"));
    }
  };

  const rejectLead = async (leadId: string, reason: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("review.leadRejected"));
        loadLeads();
        setSelectedLead(null);
      } else {
        toast.error(data.error || t("review.rejectError"));
      }
    } catch (err) {
      toast.error(t("review.rejectError"));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      in_review: "outline",
      needs_clarification: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getRiskBadge = (risk: string) => {
    const variants = {
      low: "secondary",
      medium: "outline",
      high: "destructive",
    } as const;

    return (
      <Badge variant={variants[risk as keyof typeof variants]}>
        {t(`risk.${risk}`)}
      </Badge>
    );
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {t("review.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">{t("common.search")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t("review.searchPlaceholder")}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status-filter">{t("review.statusFilter")}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="pending">{t("status.pending")}</SelectItem>
                  <SelectItem value="in_review">
                    {t("status.in_review")}
                  </SelectItem>
                  <SelectItem value="approved">
                    {t("status.approved")}
                  </SelectItem>
                  <SelectItem value="rejected">
                    {t("status.rejected")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="risk-filter">{t("review.riskFilter")}</Label>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="low">{t("risk.low")}</SelectItem>
                  <SelectItem value="medium">{t("risk.medium")}</SelectItem>
                  <SelectItem value="high">{t("risk.high")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-center">
                <div className="font-semibold text-lg">
                  {leads.filter(l => l.status === "pending").length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("review.pending")}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="font-semibold text-lg">
                  {leads.filter(l => l.status === "in_review").length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("review.inReview")}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="font-semibold text-lg">
                  {leads.filter(l => l.status === "approved").length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("review.approved")}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="font-semibold text-lg">
                  {leads.filter(l => l.status === "rejected").length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("review.rejected")}
                </div>
              </div>
            </Card>
          </div>

          {/* Lead List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">
                  {t("common.loading")}
                </p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("review.noLeads")}</p>
              </div>
            ) : (
              filteredLeads.map(lead => (
                <Card key={lead.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">
                          {lead.firstName} {lead.lastName}
                        </h4>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">
                          {lead.company}
                        </span>
                        {getStatusBadge(lead.status)}
                        {getRiskBadge(lead.riskLevel)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {lead.email}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          {t("review.confidence")}:
                          <span
                            className={`font-medium ${getConfidenceColor(lead.confidenceScore)}`}
                          >
                            {lead.confidenceScore}%
                          </span>
                        </span>
                        <span>
                          {t("review.source")}: {lead.source}
                        </span>
                        <span>
                          {t("review.submitted")}:{" "}
                          {new Date(lead.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {lead.reviewedBy && (
                        <div className="text-sm text-muted-foreground">
                          {t("review.reviewedBy")}: {lead.reviewedBy}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {t("common.view")}
                      </Button>
                      {lead.status === "pending" && (
                        <Button size="sm" onClick={() => approveLead(lead.id)}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {t("review.approve")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Review Notes */}
                  {lead.reviewNotes && (
                    <div className="mt-3 p-3 bg-muted rounded">
                      <div className="text-sm">
                        <strong>{t("review.notes")}:</strong> {lead.reviewNotes}
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {t("review.leadDetails")}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLead(null)}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("review.firstName")}</Label>
                  <Input value={selectedLead.firstName} readOnly />
                </div>
                <div>
                  <Label>{t("review.lastName")}</Label>
                  <Input value={selectedLead.lastName} readOnly />
                </div>
                <div>
                  <Label>{t("review.email")}</Label>
                  <Input value={selectedLead.email} readOnly />
                </div>
                <div>
                  <Label>{t("review.company")}</Label>
                  <Input value={selectedLead.company} readOnly />
                </div>
                <div>
                  <Label>{t("review.confidenceScore")}</Label>
                  <Input value={`${selectedLead.confidenceScore}%`} readOnly />
                </div>
                <div>
                  <Label>{t("review.source")}</Label>
                  <Input value={selectedLead.source} readOnly />
                </div>
                <div>
                  <Label>{t("review.riskLevel")}</Label>
                  <Input value={t(`risk.${selectedLead.riskLevel}`)} readOnly />
                </div>
                <div>
                  <Label>{t("review.status")}</Label>
                  <Input value={t(`status.${selectedLead.status}`)} readOnly />
                </div>
                <div>
                  <Label>{t("review.submittedAt")}</Label>
                  <Input
                    value={new Date(selectedLead.submittedAt).toLocaleString()}
                    readOnly
                  />
                </div>
                {selectedLead.reviewedBy && (
                  <div>
                    <Label>{t("review.reviewedBy")}</Label>
                    <Input value={selectedLead.reviewedBy} readOnly />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedLead.status === "pending" && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => approveLead(selectedLead.id)}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t("review.approveLead")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const reason = prompt(t("review.rejectReason"));
                      if (reason) {
                        rejectLead(selectedLead.id, reason);
                      }
                    }}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {t("review.rejectLead")}
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
