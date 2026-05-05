import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { History, Download, Filter, Search, User, Mail, Database, Settings, CreditCard, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/settings/audit")({
  component: AuditPage,
});

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

const ACTION_TYPES = [
  { value: '', label: 'Alle Aktionen' },
  { value: 'lead.discovered', label: 'Lead Discovery' },
  { value: 'email.sent', label: 'Email gesendet' },
  { value: 'email.failed', label: 'Email fehlgeschlagen' },
  { value: 'lead.deleted', label: 'Lead gelöscht' },
  { value: 'plan.upgraded', label: 'Plan geändert' },
  { value: 'workspace.settings_changed', label: 'Workspace Einstellungen' },
  { value: 'sequence.created', label: 'Sequence erstellt' },
  { value: 'lead.enrolled', label: 'Lead eingeschrieben' },
  { value: 'leads.exported', label: 'Export durchgeführt' },
];

const ACTION_ICONS: Record<string, any> = {
  'lead.discovered': Database,
  'email.sent': Mail,
  'email.failed': Mail,
  'lead.deleted': Database,
  'plan.upgraded': CreditCard,
  'workspace.settings_changed': Settings,
  'sequence.created': Database,
  'lead.enrolled': Database,
  'leads.exported': FileSpreadsheet,
};

function getActionDescription(action: string, metadata: Record<string, any>): string {
  switch (action) {
    case 'lead.discovered':
      return `${metadata.count || 0} Leads via ${metadata.provider} discovered`;
    case 'email.sent':
      return `Email an Lead gesendet: ${metadata.subject}`;
    case 'email.failed':
      return `Email fehlgeschlagen: ${metadata.error}`;
    case 'lead.deleted':
      return `Lead gelöscht: ${metadata.leadName}`;
    case 'plan.upgraded':
      return `Plan geändert von ${metadata.fromPlan} zu ${metadata.toPlan}`;
    case 'workspace.settings_changed':
      return 'Workspace-Einstellungen geändert';
    case 'sequence.created':
      return `Sequence "${metadata.sequenceName}" mit ${metadata.stepsCount} Steps erstellt`;
    case 'lead.enrolled':
      return `Lead in Sequence "${metadata.sequenceName}" eingeschrieben`;
    case 'leads.exported':
      return `${metadata.leadCount} Leads als ${metadata.format} exportiert`;
    default:
      return action;
  }
}

function getActionColor(action: string): string {
  if (action.includes('failed') || action.includes('deleted')) return 'destructive';
  if (action.includes('upgraded') || action.includes('created')) return 'default';
  if (action.includes('sent') || action.includes('discovered')) return 'secondary';
  return 'outline';
}

function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const loadLogs = async (reset = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
        ...(selectedAction && { action: selectedAction })
      });

      const res = await fetch(`/api/audit/logs?${params}`, { credentials: 'include' });
      const data = await res.json();
      
      if (data.ok) {
        const newLogs = reset ? data.logs : [...logs, ...data.logs];
        setLogs(newLogs);
        setHasMore(data.logs.length === 50);
      } else {
        toast.error('Fehler beim Laden der Audit Logs');
      }
    } catch (err) {
      toast.error('Verbindung zum Server fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(true);
  }, [selectedAction]);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      (log.resource_type && log.resource_type.toLowerCase().includes(searchLower)) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
    );
  });

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        ...(selectedAction && { action: selectedAction })
      });

      const res = await fetch(`/api/audit/logs/export?${params}`, { credentials: 'include' });
      
      if (!res.ok) {
        throw new Error('Export fehlgeschlagen');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `skerry-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Audit Logs exportiert');
    } catch (err) {
      toast.error('Export fehlgeschlagen');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground mt-2">
          Protokoll aller wichtigen Aktionen für Compliance und Nachvollziehbarkeit.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche in Logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-64">
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Aktionstyp" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exportLogs} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Aktivitätsprotokoll
            <Badge variant="secondary">{filteredLogs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {isLoading && logs.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Logs werden geladen...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Keine Logs gefunden</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map((log) => {
                  const IconComponent = ACTION_ICONS[log.action] || History;
                  return (
                    <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="mt-1">
                        <IconComponent className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getActionColor(log.action) as any}>
                            {log.action.replace('.', ' ')}
                          </Badge>
                          {log.resource_type && (
                            <Badge variant="outline" className="text-xs">
                              {log.resource_type}
                            </Badge>
                          )}
                          {log.user_id && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="w-3 h-3" />
                              System
                            </div>
                          )}
                        </div>
                        <p className="text-sm">
                          {getActionDescription(log.action, log.metadata)}
                        </p>
                        {Object.keys(log.metadata).length > 0 && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              Metadaten anzeigen
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {hasMore && !isLoading && (
                  <div className="text-center pt-4">
                    <Button onClick={() => loadLogs(false)} variant="outline">
                      Mehr laden
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
