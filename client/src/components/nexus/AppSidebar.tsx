import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
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
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  titleKey: string;
  url: string;
  icon: LucideIcon;
};

type NavGroup = {
  key: string;
  labelKey: string;
  items: NavItem[];
};

function ThinIcon({ Icon, className }: { Icon: LucideIcon; className?: string }) {
  return <Icon className={className} strokeWidth={1.5} />;
}

const navGroups: NavGroup[] = [
  {
    key: "campaigns",
    labelKey: "sidebar.group.campaigns",
    items: [
      { titleKey: "sidebar.dashboard" as const, url: "/", icon: LayoutDashboard },
      { titleKey: "sidebar.workspaces" as const, url: "/workspaces", icon: Package },
      { titleKey: "sidebar.leads" as const, url: "/workspace", icon: Users },
      { titleKey: "sidebar.review" as const, url: "/review", icon: CheckCircle },
    ],
  },
  {
    key: "intelligence",
    labelKey: "sidebar.group.intelligence",
    items: [
      { titleKey: "sidebar.leadSources" as const, url: "/lead-sources", icon: Database },
      { titleKey: "sidebar.icp" as const, url: "/icp", icon: Target },
      { titleKey: "sidebar.analytics" as const, url: "/analytics", icon: BarChart3 },
    ],
  },
  {
    key: "operations",
    labelKey: "sidebar.group.operations",
    items: [
      { titleKey: "sidebar.deduplication" as const, url: "/deduplication", icon: Ban },
      { titleKey: "sidebar.assetLibrary" as const, url: "/asset-library", icon: Archive },
      { titleKey: "sidebar.forge" as const, url: "/forge", icon: Mail },
    ],
  },
  {
    key: "system",
    labelKey: "sidebar.group.system",
    items: [
      { titleKey: "sidebar.auth" as const, url: "/auth", icon: Shield },
      { titleKey: "sidebar.billing" as const, url: "/billing", icon: CreditCard },
      { titleKey: "sidebar.settings" as const, url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: r => r.location.pathname });
  const isActive = (p: string) => currentPath === p;
  const t = useT();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    campaigns: true,
    intelligence: true,
    operations: true,
    system: true,
  });

  const toggleGroup = (key: string) => {
    if (collapsed) return;
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center">
            {/* Gantry Core Logo - 'S' form */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="gantry-grad-sidebar" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
              {/* Geometric 'S' path */}
              <path d="M12 18 L32 8 L52 18 L52 32 M12 32 L12 46 L32 56 L52 46 M32 20 L44 26 L44 38 L32 44 L20 38 L20 26 Z" stroke="url(#gantry-grad-sidebar)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Inner 'S' shape lines */}
              <path d="M32 28 V36 M28 32 H36" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-900 dark:text-white">
                Skerry
              </span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                LeadGen OS
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1 py-1">
        {navGroups.map(group => {
          const isExpanded = expandedGroups[group.key];
          return (
            <SidebarGroup key={group.key} className="py-0.5">
              {!collapsed && (
                <SidebarGroupLabel
                  className="flex cursor-pointer items-center justify-between px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span>{t(group.labelKey)}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
                  ) : (
                    <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
                  )}
                </SidebarGroupLabel>
              )}
              {isExpanded && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(item => {
                      const label = t(item.titleKey);
                      const active = isActive(item.url);
                      return (
                        <SidebarMenuItem key={item.titleKey}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={collapsed ? label : undefined}
                            className={cn(
                              "h-8 px-2 text-[13px] relative",
                              active && "bg-sidebar-accent font-medium"
                            )}
                            style={active ? {
                              borderLeft: "2px solid var(--sidebar-primary)",
                              paddingLeft: "calc(0.5rem - 2px)"
                            } : {}}
                          >
                            <Link to={item.url} className="flex items-center gap-2.5">
                              <ThinIcon Icon={item.icon} className="h-4 w-4" />
                              {!collapsed && <span>{label}</span>}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
