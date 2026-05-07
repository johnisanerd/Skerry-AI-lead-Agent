import { useLeadStore, type Lead } from "@/store/leadStore";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

type SortField = "name" | "intentScore" | "stage";
type SortDirection = "asc" | "desc";

export function LeadDataGrid() {
  const leads = useLeadStore(s => s.leads);
  const selectedId = useLeadStore(s => s.selectedId);
  const select = useLeadStore(s => s.select);
  const t = useT();

  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterScore, setFilterScore] = useState<number | null>(null);

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    if (filterScore !== null && (lead.intentScore ?? 0) < filterScore) return false;
    return true;
  });

  // Sort leads
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let aVal, bVal;
    switch (sortField) {
      case "name":
        aVal = `${a.personal.firstName} ${a.personal.lastName}`;
        bVal = `${b.personal.firstName} ${b.personal.lastName}`;
        break;
      case "intentScore":
        aVal = a.intentScore ?? 0;
        bVal = b.intentScore ?? 0;
        break;
      case "stage":
        aVal = a.stage;
        bVal = b.stage;
        break;
    }
    if (sortDirection === "asc") {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" strokeWidth={1.5} />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 text-primary" strokeWidth={1.5} />
      : <ArrowDown className="ml-1 h-3 w-3 text-primary" strokeWidth={1.5} />;
  };

  if (leads.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No leads yet</div>
        <div className="empty-state-description">
          Start a pipeline run to populate the lead database.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Intent Score ≥</span>
          <input
            type="number"
            placeholder="80"
            value={filterScore ?? ""}
            onChange={e => setFilterScore(e.target.value ? Number(e.target.value) : null)}
            className="h-7 w-16 rounded-md border border-border/50 bg-muted/30 px-2 text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground">
          {sortedLeads.length} of {leads.length} leads
        </div>
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto">
        <table className="data-grid">
          <thead>
            <tr>
              <th
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center">
                  Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("intentScore")}
              >
                <div className="flex items-center">
                  Intent Score
                  <SortIcon field="intentScore" />
                </div>
              </th>
              <th>Email</th>
              <th>Company</th>
              <th
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("stage")}
              >
                <div className="flex items-center">
                  Stage
                  <SortIcon field="stage" />
                </div>
              </th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map(lead => (
              <tr
                key={lead.id}
                className={cn(
                  "cursor-pointer",
                  lead.id === selectedId && "bg-primary/5"
                )}
                onClick={() => select(lead.id)}
              >
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50 text-[10px] font-medium">
                      {lead.personal.firstName[0]}{lead.personal.lastName[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {lead.personal.firstName} {lead.personal.lastName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {lead.personal.title}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="tabular-nums text-sm font-medium">
                    {lead.intentScore ?? "—"}
                  </span>
                </td>
                <td>
                  {lead.personal.email ? (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <Mail className="h-3 w-3" strokeWidth={1.5} />
                      {lead.personal.email}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/50">—</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                    <span className="text-sm">{lead.organization.name}</span>
                  </div>
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md",
                      lead.stage === "send" && "bg-emerald-500/10 text-emerald-400",
                      lead.stage === "source" && "bg-purple-500/10 text-purple-400",
                      lead.stage === "analyze" && "bg-blue-500/10 text-blue-400",
                      lead.stage === "draft" && "bg-sky-500/10 text-sky-400"
                    )}
                  >
                    {lead.stage}
                  </span>
                </td>
                <td className="text-right">
                  <Link
                    to="/workspace"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
