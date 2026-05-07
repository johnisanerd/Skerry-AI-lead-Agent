import { Outlet } from "@tanstack/react-router";
import { User, LogOut, Code2, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "./AppSidebar";
import { ContextHeader } from "./ContextHeader";
import { Onboarding } from "./Onboarding";
import { LoginPage } from "./LoginPage";
import { FindLeadsModal } from "./FindLeadsModal";
import { useBrand } from "@/contexts/BrandContext";
import { useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAccountTierStore } from "@/store/accountTierStore";
import { useAuthStore } from "@/store/authStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function Shell() {
  const t = useT();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFindLeads, setShowFindLeads] = useState(false);
  const tier = useAccountTierStore(s => s.tier);
  const setTier = useAccountTierStore(s => s.setTier);
  const initializeTier = useAccountTierStore(s => s.initializeFromLocalStorage);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isHydrating = useAuthStore(s => s.isHydrating);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const hydrateSession = useAuthStore(s => s.hydrateSession);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (isAuthenticated) {
      const profile = localStorage.getItem("skerry-onboarding-profile");
      if (!profile) {
        setShowOnboarding(true);
      }
      initializeTier();
      if (user?.tier) {
        setTier(user.tier);
      }
    }
  }, [isAuthenticated, initializeTier, setTier, user?.tier]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    initializeTier();
  };

  // Listen for the custom event from ContextHeader
  useEffect(() => {
    const handler = () => setShowFindLeads(true);
    window.addEventListener("open-find-leads", handler);
    return () => window.removeEventListener("open-find-leads", handler);
  }, []);

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Restoring secure session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (showOnboarding && user?.role !== "developer") {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const { brand, isLoading: isBrandLoading } = useBrand();

  const tierColors: Record<string, string> = {
    solo: "border-muted text-muted-foreground",
    team: "border-blue-500/30 text-blue-400",
    agency: "border-purple-500/30 text-purple-400",
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <SidebarProvider>
      <div className="relative z-10 flex min-h-screen w-full text-foreground">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Context Header with breadcrumbs and Cmd+K */}
          <ContextHeader />

          {/* Action Bar - Pipeline button as North Star CTA */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 h-12">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

            <div className="flex items-center gap-3">
              {/* Only prominent color-filled element - North Star CTA */}
              <Button
                onClick={() => setShowFindLeads(true)}
                size="sm"
                className="h-8 px-4 text-xs font-medium"
              >
                {t("shell.runPipeline")}
              </Button>

              {/* User Menu - subtle outline only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pl-3 border-l border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="hidden flex-col items-end leading-none sm:flex">
                      <span className="text-xs font-medium text-foreground">
                        {user?.name ?? "User"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`h-4 px-1 text-[10px] uppercase tracking-wider border-muted-foreground/30 text-muted-foreground`}
                      >
                        {tier}
                      </Badge>
                    </div>
                    <Avatar className="h-7 w-7 border border-border/50">
                      <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48"
                >
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium text-foreground">
                      {user?.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  {user?.role === "developer" && (
                    <DropdownMenuItem
                      onClick={() => {
                        localStorage.removeItem("skerry-onboarding-profile");
                        window.location.reload();
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                    >
                      <Code2 className="mr-2 h-3.5 w-3.5" />
                      {t("settings.onboarding.reset")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="text-xs cursor-pointer">
                      <Settings className="mr-2 h-3.5 w-3.5" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="text-xs text-destructive hover:text-destructive/80 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
      <FindLeadsModal
        open={showFindLeads}
        onClose={() => setShowFindLeads(false)}
      />
    </SidebarProvider>
  );
}
