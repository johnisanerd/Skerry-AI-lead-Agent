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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Shield,
  Key,
  Users,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Lock,
  Unlock,
  Activity,
  Database,
  Globe,
  Terminal,
  Code,
  Download,
  Trash2,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  lastUsed?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

interface AuthPolicy {
  id: string;
  name: string;
  type: "ip_whitelist" | "rate_limit" | "access_control" | "encryption";
  config: Record<string, any>;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  status: "success" | "failure" | "warning";
  details?: string;
}

interface ServerConfig {
  aiEndpoint: string;
  encryptionEnabled: boolean;
  rateLimiting: boolean;
  ipWhitelist: boolean;
  auditLogging: boolean;
  sessionTimeout: number;
  maxConcurrentRequests: number;
  allowedOrigins: string[];
}

export function ProductionAuth() {
  const t = useT();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [authPolicies, setAuthPolicies] = useState<AuthPolicy[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<AuthPolicy | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  const [newApiKey, setNewApiKey] = useState({
    name: "",
    permissions: [] as string[],
    expiresAt: "",
  });

  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      const [keysRes, policiesRes, logsRes, configRes] = await Promise.all([
        fetch("/api/auth/keys", { credentials: "include" }),
        fetch("/api/auth/policies", { credentials: "include" }),
        fetch("/api/auth/audit-logs", { credentials: "include" }),
        fetch("/api/auth/server-config", { credentials: "include" }),
      ]);

      const [keysData, policiesData, logsData, configData] = await Promise.all([
        keysRes.json(),
        policiesRes.json(),
        logsRes.json(),
        configRes.json(),
      ]);

      if (keysData.ok) setApiKeys(keysData.keys);
      if (policiesData.ok) setAuthPolicies(policiesData.policies);
      if (logsData.ok) setAuditLogs(logsData.logs);
      if (configData.ok) setServerConfig(configData.config);
    } catch (err) {
      toast.error(t("auth.loadError"));
    }
  };

  const createApiKey = async () => {
    if (!newApiKey.name.trim() || newApiKey.permissions.length === 0) {
      toast.error(t("auth.keyRequired"));
      return;
    }

    setIsCreatingKey(true);
    try {
      const res = await fetch("/api/auth/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newApiKey),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("auth.keyCreated"));
        setNewApiKey({ name: "", permissions: [], expiresAt: "" });
        loadAuthData();
      } else {
        toast.error(data.error || t("auth.keyCreateError"));
      }
    } catch (err) {
      toast.error(t("auth.keyCreateError"));
    } finally {
      setIsCreatingKey(false);
    }
  };

  const revokeApiKey = async (keyId: string) => {
    if (!confirm(t("auth.confirmRevoke"))) {
      return;
    }

    try {
      const res = await fetch(`/api/auth/keys/${keyId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("auth.keyRevoked"));
        loadAuthData();
        setSelectedApiKey(null);
      } else {
        toast.error(data.error || t("auth.keyRevokeError"));
      }
    } catch (err) {
      toast.error(t("auth.keyRevokeError"));
    }
  };

  const updateServerConfig = async () => {
    if (!serverConfig) return;

    setIsUpdatingConfig(true);
    try {
      const res = await fetch("/api/auth/server-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(serverConfig),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("auth.configUpdated"));
      } else {
        toast.error(data.error || t("auth.configUpdateError"));
      }
    } catch (err) {
      toast.error(t("auth.configUpdateError"));
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(t("auth.keyCopied"));
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "default",
      failure: "destructive",
      warning: "secondary",
      active: "default",
      inactive: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getPolicyIcon = (type: string) => {
    const icons = {
      ip_whitelist: Globe,
      rate_limit: Activity,
      access_control: Shield,
      encryption: Lock,
    } as const;

    return icons[type as keyof typeof icons] || Shield;
  };

  const filteredLogs = auditLogs.slice(0, 50); // Show last 50 logs

  return (
    <div className="space-y-6">
      {/* API Keys Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            {t("auth.apiKeys")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create New API Key */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-3">{t("auth.createKey")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="key-name">{t("auth.keyName")}</Label>
                <Input
                  id="key-name"
                  placeholder={t("auth.keyNamePlaceholder")}
                  value={newApiKey.name}
                  onChange={e =>
                    setNewApiKey(prev => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="key-permissions">{t("auth.permissions")}</Label>
                <Select
                  value={newApiKey.permissions[0] ?? ""}
                  onValueChange={value =>
                    setNewApiKey(prev => ({ ...prev, permissions: [value] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("auth.selectPermissions")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">
                      {t("auth.permission.read")}
                    </SelectItem>
                    <SelectItem value="write">
                      {t("auth.permission.write")}
                    </SelectItem>
                    <SelectItem value="delete">
                      {t("auth.permission.delete")}
                    </SelectItem>
                    <SelectItem value="admin">
                      {t("auth.permission.admin")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="key-expires">{t("auth.expiresAt")}</Label>
                <Input
                  id="key-expires"
                  type="date"
                  value={newApiKey.expiresAt}
                  onChange={e =>
                    setNewApiKey(prev => ({
                      ...prev,
                      expiresAt: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={createApiKey} disabled={isCreatingKey}>
                <Key className="w-4 h-4 mr-2" />
                {isCreatingKey ? t("auth.creating") : t("auth.createKey")}
              </Button>
            </div>
          </div>

          {/* API Keys List */}
          <div className="space-y-3">
            {apiKeys.map(key => (
              <Card key={key.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{key.name}</h4>
                      {getStatusBadge(key.isActive ? "active" : "inactive")}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {t("auth.createdBy")}: {key.createdBy}
                      </span>
                      <span>•</span>
                      <span>
                        {t("auth.createdAt")}:{" "}
                        {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>
                        {t("auth.usageCount")}: {key.usageCount}
                      </span>
                    </div>
                    {key.lastUsed && (
                      <div className="text-sm text-muted-foreground">
                        {t("auth.lastUsed")}:{" "}
                        {new Date(key.lastUsed).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedApiKey(key)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {t("common.view")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyApiKey(key.key)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      {t("auth.copy")}
                    </Button>
                    {key.isActive && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeApiKey(key.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {t("auth.revoke")}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Key Preview */}
                <div className="p-3 bg-muted rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      <code className="text-sm font-mono">
                        {showApiKey ? key.key : key.key.substring(0, 8) + "..."}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Permissions */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {key.permissions.map(permission => (
                    <Badge
                      key={permission}
                      variant="secondary"
                      className="text-xs"
                    >
                      {permission}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}

            {apiKeys.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("auth.noKeys")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Authentication Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t("auth.policies")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {authPolicies.map(policy => (
            <Card key={policy.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {React.createElement(getPolicyIcon(policy.type), {
                      className: "w-4 h-4",
                    })}
                    <h4 className="font-semibold">{policy.name}</h4>
                    {getStatusBadge(policy.isActive ? "active" : "inactive")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("auth.type")}: {t(`auth.policyType.${policy.type}`)} •{" "}
                    {t("auth.priority")}: {policy.priority}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("auth.createdAt")}:{" "}
                    {new Date(policy.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPolicy(policy)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {t("common.view")}
                  </Button>
                  <Button variant="outline" size="sm">
                    {policy.isActive
                      ? t("auth.deactivate")
                      : t("auth.activate")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {authPolicies.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("auth.noPolicies")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server Configuration */}
      {serverConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              {t("auth.serverConfig")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ai-endpoint">{t("auth.aiEndpoint")}</Label>
                <Input
                  id="ai-endpoint"
                  value={serverConfig.aiEndpoint}
                  onChange={e =>
                    setServerConfig(prev =>
                      prev ? { ...prev, aiEndpoint: e.target.value } : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="session-timeout">
                  {t("auth.sessionTimeout")}
                </Label>
                <Input
                  id="session-timeout"
                  type="number"
                  value={serverConfig.sessionTimeout}
                  onChange={e =>
                    setServerConfig(prev =>
                      prev
                        ? { ...prev, sessionTimeout: parseInt(e.target.value) }
                        : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="max-requests">
                  {t("auth.maxConcurrentRequests")}
                </Label>
                <Input
                  id="max-requests"
                  type="number"
                  value={serverConfig.maxConcurrentRequests}
                  onChange={e =>
                    setServerConfig(prev =>
                      prev
                        ? {
                            ...prev,
                            maxConcurrentRequests: parseInt(e.target.value),
                          }
                        : null
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="allowed-origins">
                  {t("auth.allowedOrigins")}
                </Label>
                <Textarea
                  id="allowed-origins"
                  value={serverConfig.allowedOrigins.join("\n")}
                  onChange={e =>
                    setServerConfig(prev =>
                      prev
                        ? {
                            ...prev,
                            allowedOrigins: e.target.value.split("\n"),
                          }
                        : null
                    )
                  }
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={serverConfig.encryptionEnabled}
                  onCheckedChange={checked =>
                    setServerConfig(prev =>
                      prev ? { ...prev, encryptionEnabled: checked } : null
                    )
                  }
                />
                <Label>{t("auth.encryptionEnabled")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={serverConfig.rateLimiting}
                  onCheckedChange={checked =>
                    setServerConfig(prev =>
                      prev ? { ...prev, rateLimiting: checked } : null
                    )
                  }
                />
                <Label>{t("auth.rateLimiting")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={serverConfig.ipWhitelist}
                  onCheckedChange={checked =>
                    setServerConfig(prev =>
                      prev ? { ...prev, ipWhitelist: checked } : null
                    )
                  }
                />
                <Label>{t("auth.ipWhitelist")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={serverConfig.auditLogging}
                  onCheckedChange={checked =>
                    setServerConfig(prev =>
                      prev ? { ...prev, auditLogging: checked } : null
                    )
                  }
                />
                <Label>{t("auth.auditLogging")}</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={updateServerConfig} disabled={isUpdatingConfig}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {isUpdatingConfig ? t("auth.updating") : t("auth.updateConfig")}
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                {t("auth.exportConfig")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            {t("auth.auditLogs")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredLogs.map(log => (
              <div
                key={log.id}
                className="flex items-start justify-between p-3 border rounded"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{log.action}</span>
                    {getStatusBadge(log.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("auth.resource")}: {log.resource} • {t("auth.user")}:{" "}
                    {log.userId}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("auth.ip")}: {log.ipAddress} • {t("auth.timestamp")}:{" "}
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  {log.details && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {t("auth.details")}: {log.details}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("auth.noLogs")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key Detail Modal */}
      {selectedApiKey && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  {t("auth.keyDetails")} - {selectedApiKey.name}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedApiKey(null)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("auth.keyName")}</Label>
                  <Input value={selectedApiKey.name} readOnly />
                </div>
                <div>
                  <Label>{t("auth.status")}</Label>
                  <Input
                    value={
                      selectedApiKey.isActive
                        ? t("status.active")
                        : t("status.inactive")
                    }
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("auth.createdBy")}</Label>
                  <Input value={selectedApiKey.createdBy} readOnly />
                </div>
                <div>
                  <Label>{t("auth.createdAt")}</Label>
                  <Input
                    value={new Date(selectedApiKey.createdAt).toLocaleString()}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("auth.usageCount")}</Label>
                  <Input
                    value={selectedApiKey.usageCount.toString()}
                    readOnly
                  />
                </div>
                {selectedApiKey.lastUsed && (
                  <div>
                    <Label>{t("auth.lastUsed")}</Label>
                    <Input
                      value={new Date(selectedApiKey.lastUsed).toLocaleString()}
                      readOnly
                    />
                  </div>
                )}
                {selectedApiKey.expiresAt && (
                  <div>
                    <Label>{t("auth.expiresAt")}</Label>
                    <Input
                      value={new Date(
                        selectedApiKey.expiresAt
                      ).toLocaleString()}
                      readOnly
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>{t("auth.apiKey")}</Label>
                <div className="p-3 bg-muted rounded">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono">
                      {selectedApiKey.key}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyApiKey(selectedApiKey.key)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      {t("auth.copy")}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label>{t("auth.permissions")}</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedApiKey.permissions.map(permission => (
                    <Badge key={permission} variant="secondary">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              {selectedApiKey.isActive && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => revokeApiKey(selectedApiKey.id)}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("auth.revokeKey")}
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
