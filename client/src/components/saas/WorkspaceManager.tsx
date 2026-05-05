import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Settings,
  Users,
  Mail,
  BarChart3,
  Archive,
  Trash2,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface Workspace {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "suspended";
  campaignCount: number;
  leadCount: number;
  createdAt: string;
  lastActivity: string;
}

interface Campaign {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  workspaceId: string;
  leadCount: number;
  sentCount: number;
  openRate: number;
  replyRate: number;
  createdAt: string;
}

export function WorkspaceManager() {
  const t = useT();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");

  useEffect(() => {
    loadWorkspaces();
    loadCampaigns();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const res = await fetch("/api/workspaces", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setWorkspaces(data.workspaces);
        if (data.workspaces.length > 0 && !selectedWorkspace) {
          setSelectedWorkspace(data.workspaces[0].id);
        }
      }
    } catch (err) {
      toast.error(t("workspace.loadError"));
    }
  };

  const loadCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setCampaigns(data.campaigns);
      }
    } catch (err) {
      toast.error(t("campaign.loadError"));
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error(t("workspace.nameRequired"));
      return;
    }

    setIsCreatingWorkspace(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newWorkspaceName }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("workspace.created"));
        setNewWorkspaceName("");
        loadWorkspaces();
      } else {
        toast.error(data.error || t("workspace.createError"));
      }
    } catch (err) {
      toast.error(t("workspace.createError"));
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const createCampaign = async () => {
    if (!selectedWorkspace) {
      toast.error(t("campaign.selectWorkspace"));
      return;
    }

    if (!newCampaignName.trim()) {
      toast.error(t("campaign.nameRequired"));
      return;
    }

    setIsCreatingCampaign(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newCampaignName,
          workspaceId: selectedWorkspace,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("campaign.created"));
        setNewCampaignName("");
        loadCampaigns();
      } else {
        toast.error(data.error || t("campaign.createError"));
      }
    } catch (err) {
      toast.error(t("campaign.createError"));
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
      draft: "secondary",
      paused: "outline",
      completed: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const filteredCampaigns = campaigns.filter(
    c => c.workspaceId === selectedWorkspace
  );

  return (
    <div className="space-y-6">
      {/* Workspace Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("workspace.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="workspace-select">{t("workspace.select")}</Label>
              <Select
                value={selectedWorkspace}
                onValueChange={setSelectedWorkspace}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("workspace.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map(workspace => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t("workspace.newName")}
                value={newWorkspaceName}
                onChange={e => setNewWorkspaceName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={createWorkspace} disabled={isCreatingWorkspace}>
                <Plus className="w-4 h-4 mr-2" />
                {isCreatingWorkspace
                  ? t("common.creating")
                  : t("workspace.create")}
              </Button>
            </div>
          </div>

          {/* Workspace List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map(workspace => (
              <Card
                key={workspace.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{workspace.name}</h3>
                    {getStatusBadge(workspace.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {workspace.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        {t("workspace.campaigns")}:
                      </span>
                      <span className="font-medium">
                        {workspace.campaignCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("workspace.leads")}:
                      </span>
                      <span className="font-medium">{workspace.leadCount}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {t("workspace.lastActivity")}:{" "}
                    {new Date(workspace.lastActivity).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {t("campaign.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="campaign-name">{t("campaign.name")}</Label>
              <Input
                id="campaign-name"
                placeholder={t("campaign.newName")}
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
              />
            </div>
            <Button
              onClick={createCampaign}
              disabled={isCreatingCampaign || !selectedWorkspace}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isCreatingCampaign ? t("common.creating") : t("campaign.create")}
            </Button>
          </div>

          {/* Campaign List */}
          <div className="space-y-3">
            {filteredCampaigns.map(campaign => (
              <Card key={campaign.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{campaign.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(campaign.status)}
                      <span className="text-sm text-muted-foreground">
                        {t("campaign.createdAt")}:{" "}
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <BarChart3 className="w-4 h-4 mr-1" />
                      {t("campaign.analytics")}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-1" />
                      {t("common.settings")}
                    </Button>
                  </div>
                </div>

                {/* Campaign Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-3 bg-muted rounded">
                    <div className="font-semibold text-lg">
                      {campaign.leadCount}
                    </div>
                    <div className="text-muted-foreground">
                      {t("campaign.leads")}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded">
                    <div className="font-semibold text-lg">
                      {campaign.sentCount}
                    </div>
                    <div className="text-muted-foreground">
                      {t("campaign.sent")}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded">
                    <div className="font-semibold text-lg">
                      {campaign.openRate}%
                    </div>
                    <div className="text-muted-foreground">
                      {t("campaign.openRate")}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded">
                    <div className="font-semibold text-lg">
                      {campaign.replyRate}%
                    </div>
                    <div className="text-muted-foreground">
                      {t("campaign.replyRate")}
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {filteredCampaigns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("campaign.noCampaigns")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
