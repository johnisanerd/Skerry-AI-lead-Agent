import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Mail,
  Settings,
  Hexagon,
  CreditCard,
  GitBranch,
  Target,
  Shield,
  FileSpreadsheet,
  Package,
  CheckCircle,
  Database,
  Ban,
  Archive,
  MessageSquare,
  BarChart3,
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

const items = [
  { titleKey: "sidebar.dashboard" as const, url: "/", icon: LayoutDashboard },
  {
    titleKey: "sidebar.workspaces" as const,
    url: "/workspaces",
    icon: Package,
  },
  { titleKey: "sidebar.leads" as const, url: "/workspace", icon: Users },
  { titleKey: "sidebar.review" as const, url: "/review", icon: CheckCircle },
  {
    titleKey: "sidebar.leadSources" as const,
    url: "/lead-sources",
    icon: Database,
  },
  {
    titleKey: "sidebar.deduplication" as const,
    url: "/deduplication",
    icon: Ban,
  },
  {
    titleKey: "sidebar.assetLibrary" as const,
    url: "/asset-library",
    icon: Archive,
  },
  {
    titleKey: "sidebar.feedback" as const,
    url: "/feedback",
    icon: MessageSquare,
  },
  {
    titleKey: "sidebar.analytics" as const,
    url: "/analytics",
    icon: BarChart3,
  },
  {
    titleKey: "sidebar.sequences" as const,
    url: "/sequences",
    icon: GitBranch,
  },
  { titleKey: "sidebar.icp" as const, url: "/icp", icon: Target },
  { titleKey: "sidebar.forge" as const, url: "/forge", icon: Mail },
  { titleKey: "sidebar.auth" as const, url: "/auth", icon: Shield },
  { titleKey: "sidebar.billing" as const, url: "/billing", icon: CreditCard },
  { titleKey: "sidebar.settings" as const, url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: r => r.location.pathname });
  const isActive = (p: string) => currentPath === p;
  const t = useT();

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <SidebarHeader className="border-b border-white/5">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/30 to-fuchsia-500/10 ring-1 ring-purple-300/30">
            <Hexagon className="h-4 w-4 text-purple-200" strokeWidth={2.2} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Skerry
              </span>
              <span className="text-sm font-semibold text-gradient-cyber">
                LeadGen OS
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => {
                const label = t(item.titleKey);
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={label}
                    >
                      <Link to={item.url} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
