import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Database, Users } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  selectedLeadIds?: string[];
  totalLeads?: number;
  workspaceId: string;
}

export function ExportButton({ 
  selectedLeadIds = [], 
  totalLeads = 0, 
  workspaceId 
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'hubspot' | 'salesforce') => {
    setIsExporting(format);
    
    try {
      // Build URL with parameters
      const params = new URLSearchParams({
        format,
        workspaceId,
        ...(selectedLeadIds.length > 0 && { leadIds: selectedLeadIds.join(',') })
      });

      const response = await fetch(`/api/leads/export?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get filename from headers or create default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `skerry-leads-${format}-${new Date().toISOString().split('T')[0]}.${format === 'hubspot' ? 'json' : 'csv'}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const exportedCount = selectedLeadIds.length || totalLeads;
      toast.success(`${exportedCount} Leads als ${format.toUpperCase()} exportiert`);

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export fehlgeschlagen');
    } finally {
      setIsExporting(null);
    }
  };

  const exportOptions = [
    {
      id: 'csv',
      label: 'CSV Export',
      description: 'Excel-kompatibel',
      icon: FileSpreadsheet,
      color: 'text-green-600'
    },
    {
      id: 'hubspot',
      label: 'HubSpot Import',
      description: 'JSON Format',
      icon: Database,
      color: 'text-orange-600'
    },
    {
      id: 'salesforce',
      label: 'Salesforce Import',
      description: 'Custom Fields',
      icon: Users,
      color: 'text-blue-600'
    }
  ];

  const selectedCount = selectedLeadIds.length;
  const displayCount = selectedCount > 0 ? selectedCount : totalLeads;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={displayCount === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export
          {displayCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {displayCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          const isLoading = isExporting === option.id;
          
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => handleExport(option.id as any)}
              disabled={isLoading}
              className="flex items-center gap-3"
            >
              <Icon className={`w-4 h-4 ${option.color}`} />
              <div className="flex-1">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">
                  {option.description}
                </div>
              </div>
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
