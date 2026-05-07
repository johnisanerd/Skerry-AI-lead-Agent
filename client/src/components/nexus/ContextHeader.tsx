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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Extract workspace ID from path if present
  const pathSegments = currentPath.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Build breadcrumbs
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

  return (
    <>
      <header className="context-header border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Breadcrumb Navigation */}
          <nav className="breadcrumb-nav flex items-center gap-1 text-sm">
            <Link
              to="/"
              className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.label} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground/50" strokeWidth={1.5} />
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>

          {/* Cmd+K Command Bar Trigger */}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground",
              "border border-border/50 rounded-md bg-background hover:bg-muted/50",
              "transition-colors"
            )}
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Search...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>
      </header>

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
    </>
  );
}
