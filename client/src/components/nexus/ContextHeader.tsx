import { useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useT } from "@/lib/i18n";
import {
  Home,
  ChevronRight,
  Search,
  LayoutDashboard,
  Package,
  Users,
  CheckCircle,
  Database,
  Target,
  BarChart3,
  GitBranch,
  Ban,
  Archive,
  MessageSquare,
  Mail,
  Shield,
  CreditCard,
  Settings,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccountTierStore } from "@/store/accountTierStore";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/workspaces": "Workspaces",
  "/workspace": "Leads",
  "/review": "Review Queue",
  "/lead-sources": "Lead Sources",
  "/deduplication": "Deduplication",
  "/asset-library": "Asset Library",
  "/feedback": "Feedback",
  "/analytics": "Analytics",
  "/sequences": "Sequences",
  "/icp": "ICP",
  "/forge": "Email Forge",
  "/auth": "Security",
  "/billing": "Billing",
  "/settings": "Settings",
  "/settings/branding": "Branding",
  "/settings/audit": "Audit Log",
};

const commandItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Workspaces", href: "/workspaces", icon: Package },
  { label: "Leads", href: "/workspace", icon: Users },
  { label: "Review Queue", href: "/review", icon: CheckCircle },
  { label: "Lead Sources", href: "/lead-sources", icon: Database },
  { label: "Deduplication", href: "/deduplication", icon: Ban },
  { label: "Asset Library", href: "/asset-library", icon: Archive },
  { label: "Feedback", href: "/feedback", icon: MessageSquare },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Sequences", href: "/sequences", icon: GitBranch },
  { label: "ICP", href: "/icp", icon: Target },
  { label: "Email Forge", href: "/forge", icon: Mail },
  { label: "Security", href: "/auth", icon: Shield },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function ContextHeader() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const t = useT();
  const [open, setOpen] = useState(false);
  const tier = useAccountTierStore(s => s.tier);

  // Extract workspace ID from path if present
  const pathSegments = currentPath.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Build breadcrumbs - show "Workspace / Dashboard" format
  let accumulatedPath = "";
  pathSegments.forEach((segment, index) => {
    accumulatedPath += `/${segment}`;
    const label = routeLabels[accumulatedPath] || segment;
    const isLast = index === pathSegments.length - 1;
    breadcrumbs.push({
      label,
      href: isLast ? undefined : accumulatedPath,
    });
  });

  // If no breadcrumbs, add Dashboard
  if (breadcrumbs.length === 0) {
    breadcrumbs.push({ label: "Dashboard", href: "/" });
  }

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const tierColors: Record<string, string> = {
    solo: "border-muted text-muted-foreground",
    team: "border-blue-500/30 text-blue-400",
    agency: "border-purple-500/30 text-purple-400",
  };

  return (
    <header className="context-header border-b border-border bg-[#09090b]">
      <div className="flex items-center justify-between px-4 h-12">
        {/* Left: Breadcrumbs with System Status */}
        <nav className="breadcrumb-nav flex items-center gap-2 text-sm flex-shrink-0">
          <Link
            to="/"
            className="flex items-center text-zinc-100 hover:text-white transition-colors"
          >
            <Home className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.label} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-zinc-100/50" strokeWidth={1.5} />
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="text-zinc-100 hover:text-white transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-white font-medium">{crumb.label}</span>
              )}
            </div>
          ))}
          
          {/* System Status Pill with green pulse animation */}
          <div className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#18181b] border border-[#27272a]">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </div>
            <span className="text-[11px] text-zinc-100/70">Nodes: Operational</span>
          </div>
        </nav>

        {/* Center: Cmd+K Search Bar (bg-zinc-900/50, 1px border) */}
        <div className="flex-grow max-w-lg mx-auto px-4">
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex items-center gap-2 w-full px-4 py-1.5 text-xs text-zinc-100",
              "bg-zinc-900/50 border border-[#27272a] rounded-md",
              "hover:border-[#3f3f46] transition-colors"
            )}
          >
            <Search className="h-3.5 w-3.5 text-zinc-100" strokeWidth={1.5} />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="inline-flex h-5 items-center gap-1 rounded border border-[#27272a] bg-[#0c0c0e] px-1.5 font-mono text-[10px] text-zinc-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right: User Profile with Tier Badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#18181b] border",
            tierColors[tier] || tierColors.solo
          )}>
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[10px] font-medium text-primary">
                {tier ? tier.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-zinc-100 capitalize">{tier || 'User'}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-zinc-100" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="rounded-lg border border-border/50 shadow-2xl">
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {commandItems.map(item => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    setOpen(false);
                    window.location.href = item.href;
                  }}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  // Trigger find leads modal
                  window.dispatchEvent(new CustomEvent("open-find-leads"));
                }}
                className="cursor-pointer"
              >
                <Search className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Find New Leads
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </header>
  );
}
