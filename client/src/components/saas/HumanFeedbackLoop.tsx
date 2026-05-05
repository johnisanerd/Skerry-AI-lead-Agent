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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Search,
  Filter,
  Download,
  Reply,
  Star,
  TrendingUp,
  Users,
  Mail,
  Target,
  Eye,
  Trash2,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface Feedback {
  id: string;
  type:
    | "lead_quality"
    | "email_performance"
    | "campaign_effectiveness"
    | "ui_experience"
    | "bug_report"
    | "feature_request";
  category: "positive" | "negative" | "neutral" | "improvement";
  title: string;
  description: string;
  rating: number;
  userEmail?: string;
  leadId?: string;
  campaignId?: string;
  status: "pending" | "in_review" | "resolved" | "implemented";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  response?: string;
  respondedBy?: string;
  respondedAt?: string;
}

interface FeedbackMetrics {
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  averageRating: number;
  responseTime: number;
  resolutionRate: number;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
}

export function HumanFeedbackLoop() {
  const t = useT();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [metrics, setMetrics] = useState<FeedbackMetrics | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newFeedback, setNewFeedback] = useState({
    type: "lead_quality" as const,
    category: "neutral" as const,
    title: "",
    description: "",
    rating: 5,
    priority: "medium" as const,
  });

  useEffect(() => {
    loadFeedback();
    loadMetrics();
  }, []);

  const loadFeedback = async () => {
    try {
      const res = await fetch("/api/feedback", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setFeedback(data.feedback);
      }
    } catch (err) {
      toast.error(t("feedback.loadError"));
    }
  };

  const loadMetrics = async () => {
    try {
      const res = await fetch("/api/feedback/metrics", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Failed to load metrics:", err);
    }
  };

  const submitFeedback = async () => {
    if (!newFeedback.title.trim() || !newFeedback.description.trim()) {
      toast.error(t("feedback.requiredFields"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newFeedback),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("feedback.submitted"));
        setNewFeedback({
          type: "lead_quality",
          category: "neutral",
          title: "",
          description: "",
          rating: 5,
          priority: "medium",
        });
        loadFeedback();
        loadMetrics();
      } else {
        toast.error(data.error || t("feedback.submitError"));
      }
    } catch (err) {
      toast.error(t("feedback.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const respondToFeedback = async (feedbackId: string, response: string) => {
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("feedback.responded"));
        loadFeedback();
        setSelectedFeedback(null);
      } else {
        toast.error(data.error || t("feedback.respondError"));
      }
    } catch (err) {
      toast.error(t("feedback.respondError"));
    }
  };

  const updateFeedbackStatus = async (feedbackId: string, status: string) => {
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("feedback.statusUpdated"));
        loadFeedback();
        setSelectedFeedback(null);
      } else {
        toast.error(data.error || t("feedback.statusUpdateError"));
      }
    } catch (err) {
      toast.error(t("feedback.statusUpdateError"));
    }
  };

  const exportFeedback = async () => {
    try {
      const res = await fetch("/api/feedback/export", {
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "feedback.csv";
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(t("feedback.exported"));
      }
    } catch (err) {
      toast.error(t("feedback.exportError"));
    }
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      lead_quality: Users,
      email_performance: Mail,
      campaign_effectiveness: Target,
      ui_experience: MessageSquare,
      bug_report: AlertTriangle,
      feature_request: Star,
    } as const;

    return icons[type as keyof typeof icons] || MessageSquare;
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      positive: ThumbsUp,
      negative: ThumbsDown,
      neutral: MessageSquare,
      improvement: TrendingUp,
    } as const;

    return icons[category as keyof typeof icons] || MessageSquare;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "text-green-600",
      medium: "text-yellow-600",
      high: "text-orange-600",
      urgent: "text-red-600",
    } as const;

    return colors[priority as keyof typeof colors] || "text-gray-600";
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      in_review: "outline",
      resolved: "default",
      implemented: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? "text-yellow-400 fill-current" : "text-gray-300"}`}
      />
    ));
  };

  const filteredFeedback = feedback.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Feedback Metrics */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t("feedback.metrics")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded">
                <div className="font-semibold text-lg">
                  {metrics.totalFeedback}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("feedback.total")}
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <div className="font-semibold text-lg text-green-700">
                  {metrics.positiveFeedback}
                </div>
                <div className="text-sm text-green-600">
                  {t("feedback.positive")}
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded">
                <div className="font-semibold text-lg text-red-700">
                  {metrics.negativeFeedback}
                </div>
                <div className="text-sm text-red-600">
                  {t("feedback.negative")}
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded">
                <div className="font-semibold text-lg text-blue-700">
                  {metrics.averageRating.toFixed(1)}
                </div>
                <div className="text-sm text-blue-600">
                  {t("feedback.averageRating")}
                </div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded">
                <div className="font-semibold text-lg text-purple-700">
                  {metrics.responseTime}h
                </div>
                <div className="text-sm text-purple-600">
                  {t("feedback.responseTime")}
                </div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded">
                <div className="font-semibold text-lg text-orange-700">
                  {metrics.resolutionRate}%
                </div>
                <div className="text-sm text-orange-600">
                  {t("feedback.resolutionRate")}
                </div>
              </div>
            </div>

            {/* Top Categories */}
            <div className="mt-6">
              <h3 className="font-semibold mb-3">
                {t("feedback.topCategories")}
              </h3>
              <div className="space-y-2">
                {metrics.topCategories.map((cat, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                  >
                    <div className="flex items-center gap-2">
                      {React.createElement(getCategoryIcon(cat.category), {
                        className: "w-4 h-4",
                      })}
                      <span className="font-medium">
                        {t(`feedback.category.${cat.category}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {cat.count}
                      </span>
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${(cat.count / metrics.totalFeedback) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit New Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t("feedback.submitFeedback")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="feedback-type">{t("feedback.type")}</Label>
              <Select
                value={newFeedback.type}
                onValueChange={(value: any) =>
                  setNewFeedback(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_quality">
                    {t("feedback.type.lead_quality")}
                  </SelectItem>
                  <SelectItem value="email_performance">
                    {t("feedback.type.email_performance")}
                  </SelectItem>
                  <SelectItem value="campaign_effectiveness">
                    {t("feedback.type.campaign_effectiveness")}
                  </SelectItem>
                  <SelectItem value="ui_experience">
                    {t("feedback.type.ui_experience")}
                  </SelectItem>
                  <SelectItem value="bug_report">
                    {t("feedback.type.bug_report")}
                  </SelectItem>
                  <SelectItem value="feature_request">
                    {t("feedback.type.feature_request")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="feedback-category">
                {t("feedback.category")}
              </Label>
              <Select
                value={newFeedback.category}
                onValueChange={(value: any) =>
                  setNewFeedback(prev => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">
                    {t("feedback.category.positive")}
                  </SelectItem>
                  <SelectItem value="negative">
                    {t("feedback.category.negative")}
                  </SelectItem>
                  <SelectItem value="neutral">
                    {t("feedback.category.neutral")}
                  </SelectItem>
                  <SelectItem value="improvement">
                    {t("feedback.category.improvement")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="feedback-priority">
                {t("feedback.priority")}
              </Label>
              <Select
                value={newFeedback.priority}
                onValueChange={(value: any) =>
                  setNewFeedback(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    {t("feedback.priority.low")}
                  </SelectItem>
                  <SelectItem value="medium">
                    {t("feedback.priority.medium")}
                  </SelectItem>
                  <SelectItem value="high">
                    {t("feedback.priority.high")}
                  </SelectItem>
                  <SelectItem value="urgent">
                    {t("feedback.priority.urgent")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="feedback-title">{t("feedback.title")}</Label>
            <Input
              id="feedback-title"
              placeholder={t("feedback.titlePlaceholder")}
              value={newFeedback.title}
              onChange={e =>
                setNewFeedback(prev => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="feedback-rating">{t("feedback.rating")}</Label>
            <div className="flex gap-2">
              {getRatingStars(newFeedback.rating)}
              <span className="text-sm text-muted-foreground ml-2">
                {newFeedback.rating}/5
              </span>
            </div>
            <Input
              type="range"
              min="1"
              max="5"
              value={newFeedback.rating}
              onChange={e =>
                setNewFeedback(prev => ({
                  ...prev,
                  rating: parseInt(e.target.value),
                }))
              }
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="feedback-description">
              {t("feedback.description")}
            </Label>
            <Textarea
              id="feedback-description"
              placeholder={t("feedback.descriptionPlaceholder")}
              value={newFeedback.description}
              onChange={e =>
                setNewFeedback(prev => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={4}
            />
          </div>

          <Button onClick={submitFeedback} disabled={isSubmitting}>
            <MessageSquare className="w-4 h-4 mr-2" />
            {isSubmitting ? t("feedback.submitting") : t("feedback.submit")}
          </Button>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t("feedback.feedbackList")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("feedback.searchPlaceholder")}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("feedback.filterByType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="lead_quality">
                    {t("feedback.type.lead_quality")}
                  </SelectItem>
                  <SelectItem value="email_performance">
                    {t("feedback.type.email_performance")}
                  </SelectItem>
                  <SelectItem value="campaign_effectiveness">
                    {t("feedback.type.campaign_effectiveness")}
                  </SelectItem>
                  <SelectItem value="ui_experience">
                    {t("feedback.type.ui_experience")}
                  </SelectItem>
                  <SelectItem value="bug_report">
                    {t("feedback.type.bug_report")}
                  </SelectItem>
                  <SelectItem value="feature_request">
                    {t("feedback.type.feature_request")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("feedback.filterByStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="pending">{t("status.pending")}</SelectItem>
                  <SelectItem value="in_review">
                    {t("status.in_review")}
                  </SelectItem>
                  <SelectItem value="resolved">
                    {t("status.resolved")}
                  </SelectItem>
                  <SelectItem value="implemented">
                    {t("status.implemented")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportFeedback}>
              <Download className="w-4 h-4 mr-2" />
              {t("feedback.export")}
            </Button>
          </div>

          {/* Feedback Items */}
          <div className="space-y-3">
            {filteredFeedback.map(item => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(getTypeIcon(item.type), {
                        className: "w-4 h-4",
                      })}
                      <h4 className="font-semibold">{item.title}</h4>
                      {getStatusBadge(item.status)}
                      <Badge
                        variant="outline"
                        className={getPriorityColor(item.priority)}
                      >
                        {t(`feedback.priority.${item.priority}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {t("feedback.type")}: {t(`feedback.type.${item.type}`)}
                      </span>
                      <span>•</span>
                      <span>
                        {t("feedback.category")}:{" "}
                        {t(`feedback.category.${item.category}`)}
                      </span>
                      <span>•</span>
                      <span>
                        {t("feedback.createdAt")}:{" "}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFeedback(item)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {t("common.view")}
                    </Button>
                    {item.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          updateFeedbackStatus(item.id, "in_review")
                        }
                      >
                        <Clock className="w-4 h-4 mr-1" />
                        {t("feedback.startReview")}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">
                    {t("feedback.rating")}:
                  </span>
                  <div className="flex gap-1">
                    {getRatingStars(item.rating)}
                  </div>
                  <span className="text-sm font-medium">{item.rating}/5</span>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-3">
                  {item.description}
                </p>

                {/* Response */}
                {item.response && (
                  <div className="p-3 bg-muted rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <Reply className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {t("feedback.response")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.respondedBy} •{" "}
                        {new Date(item.respondedAt!).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{item.response}</p>
                  </div>
                )}
              </Card>
            ))}

            {filteredFeedback.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("feedback.noFeedback")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Detail Modal */}
      {selectedFeedback && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {React.createElement(getTypeIcon(selectedFeedback.type), {
                    className: "w-5 h-5",
                  })}
                  {t("feedback.details")} - {selectedFeedback.title}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFeedback(null)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("feedback.type")}</Label>
                  <Input
                    value={t(`feedback.type.${selectedFeedback.type}`)}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("feedback.category")}</Label>
                  <Input
                    value={t(`feedback.category.${selectedFeedback.category}`)}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("feedback.priority")}</Label>
                  <Input
                    value={t(`feedback.priority.${selectedFeedback.priority}`)}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("feedback.status")}</Label>
                  <Input
                    value={t(`status.${selectedFeedback.status}`)}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("feedback.rating")}</Label>
                  <div className="flex gap-1">
                    {getRatingStars(selectedFeedback.rating)}
                  </div>
                </div>
                <div>
                  <Label>{t("feedback.createdAt")}</Label>
                  <Input
                    value={new Date(
                      selectedFeedback.createdAt
                    ).toLocaleString()}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("feedback.updatedAt")}</Label>
                  <Input
                    value={new Date(
                      selectedFeedback.updatedAt
                    ).toLocaleString()}
                    readOnly
                  />
                </div>
                {selectedFeedback.userEmail && (
                  <div>
                    <Label>{t("feedback.userEmail")}</Label>
                    <Input value={selectedFeedback.userEmail} readOnly />
                  </div>
                )}
              </div>

              <div>
                <Label>{t("feedback.description")}</Label>
                <Textarea
                  value={selectedFeedback.description}
                  readOnly
                  rows={4}
                />
              </div>

              {/* Response Section */}
              {selectedFeedback.status !== "pending" && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">
                    {t("feedback.responseSection")}
                  </h3>
                  {selectedFeedback.response ? (
                    <div className="p-3 bg-muted rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Reply className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {selectedFeedback.respondedBy}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          •{" "}
                          {new Date(
                            selectedFeedback.respondedAt!
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">{selectedFeedback.response}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        placeholder={t("feedback.responsePlaceholder")}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            const textarea = document.querySelector(
                              "textarea"
                            ) as HTMLTextAreaElement;
                            if (textarea?.value.trim()) {
                              respondToFeedback(
                                selectedFeedback.id,
                                textarea.value
                              );
                            }
                          }}
                        >
                          <Reply className="w-4 h-4 mr-2" />
                          {t("feedback.respond")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            updateFeedbackStatus(
                              selectedFeedback.id,
                              "resolved"
                            )
                          }
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {t("feedback.markResolved")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {selectedFeedback.status === "pending" && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() =>
                      updateFeedbackStatus(selectedFeedback.id, "in_review")
                    }
                    className="flex-1"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {t("feedback.startReview")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      updateFeedbackStatus(selectedFeedback.id, "resolved")
                    }
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t("feedback.markResolved")}
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
