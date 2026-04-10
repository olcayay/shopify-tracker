"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Settings,
  Shield,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";
import { extractPlatform, getNavItems, systemAdminItems, globalNavItems, isOnPlatformPage, isOnGlobalPage } from "@/lib/nav-utils";
import { PLATFORMS, type PlatformId, platformFeatureFlagSlug } from "@appranks/shared";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";

function SidebarContent({
  collapsed = false,
  onNavigate,
  showCollapseToggle = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, account, logout, impersonation, globalPlatformVisibility } = useAuth();
  const isSystemAdmin = user?.isSystemAdmin;
  const enabledPlatforms = account?.enabledPlatforms ?? [];
  const enabledFeatures = account?.enabledFeatures ?? [];
  const isAdminSection = pathname.startsWith("/system-admin");

  // Filter platforms by both account-level enablement and feature flags
  const enabledFeatureSet = useMemo(() => new Set(enabledFeatures), [enabledFeatures]);
  const accessiblePlatforms = useMemo<PlatformId[]>(() => {
    if (isSystemAdmin) return Object.keys(PLATFORMS) as PlatformId[];
    return enabledPlatforms.filter(
      (pid) => pid in PLATFORMS && enabledFeatureSet.has(platformFeatureFlagSlug(pid as PlatformId))
    ) as PlatformId[];
  }, [isSystemAdmin, enabledPlatforms, enabledFeatureSet]);

  const currentPlatform = extractPlatform(pathname);
  const [expandedPlatform, setExpandedPlatform] = useState<PlatformId | null>(currentPlatform);

  // Sync expanded platform when URL changes
  useEffect(() => {
    setExpandedPlatform(currentPlatform);
  }, [currentPlatform]);

  // Route protection: redirect to /overview if user navigates to a platform they don't have access to
  useEffect(() => {
    if (!user || !account || isSystemAdmin) return;
    const urlPlatform = extractPlatform(pathname);
    // Only redirect if the pathname actually starts with a platform segment
    if (pathname.startsWith(`/${urlPlatform}`) && !accessiblePlatforms.includes(urlPlatform)) {
      router.replace("/overview");
    }
  }, [pathname, user, account, isSystemAdmin, accessiblePlatforms, router]);

  const isGlobalPage = isOnGlobalPage(pathname);
  const isPlatformPage = isOnPlatformPage(pathname);

  // Accent color for active links — platform color on platform pages, default otherwise
  const accentColor = isPlatformPage ? PLATFORM_COLORS[currentPlatform] : undefined;

  function NavLink({ href, icon: Icon, label, isActive, iconSize = "h-4 w-4", className = "", badge, adminOnly }: {
    href: string; icon: any; label: string; isActive: boolean; iconSize?: string; className?: string; badge?: string; adminOnly?: boolean;
  }) {
    const activeStyle = isActive && accentColor
      ? { backgroundColor: accentColor, color: "var(--primary-foreground)" }
      : undefined;

    const content = (
      <Link
        href={href}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-md text-sm transition-colors min-h-[44px] ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2"} ${className} ${
          isActive
            ? "font-medium text-primary-foreground"
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        }`}
        style={
          isActive
            ? activeStyle ?? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
            : undefined
        }
      >
        <Icon className={`${iconSize} shrink-0`} />
        {!collapsed && label}
        {!collapsed && adminOnly && (
          <Shield className={`h-3 w-3 shrink-0 ${isActive ? "text-primary-foreground/60" : "text-amber-500"}`} />
        )}
        {!collapsed && badge && (
          <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
          }`}>
            {badge}
          </span>
        )}
      </Link>
    );
    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{label}{adminOnly && " (Admin)"}</TooltipContent>
        </Tooltip>
      );
    }
    return content;
  }

  // Filter global nav items by feature flags (e.g. hide Notifications when flag is off)
  const filteredGlobalNav = useMemo(
    () => globalNavItems.filter((item) => item.href !== "/notifications" || enabledFeatures.includes("notifications")),
    [enabledFeatures]
  );

  // In collapsed mode, show appropriate nav icons
  const activePlatformItems = useMemo(() => {
    if (isGlobalPage) return filteredGlobalNav;
    return getNavItems(currentPlatform, isSystemAdmin, enabledFeatures);
  }, [currentPlatform, isSystemAdmin, isGlobalPage, enabledFeatures, filteredGlobalNav]);

  return (
    <>
      {showCollapseToggle && (
        <div className={`flex items-center mb-4 ${collapsed ? "justify-center" : "justify-between px-1"}`}>
          {!collapsed && (
            <Link href="/overview" className="font-semibold text-lg px-2 hover:text-primary transition-colors">
              AppRanks
            </Link>
          )}
          <button
            onClick={onToggleCollapsed}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      )}

      <nav className="flex flex-col gap-1 flex-1">
        {collapsed ? (
          /* Collapsed: show appropriate nav icons */
          activePlatformItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} isActive={isActive} badge={item.badge} adminOnly={item.adminOnly} />
            );
          })
        ) : isGlobalPage && !isPlatformPage ? (
          /* Global page: show global nav items as flat list */
          filteredGlobalNav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} isActive={isActive} />
            );
          })
        ) : (
          /* Platform page: platform accordion */
          accessiblePlatforms
            .map((platformId) => {
            const isExpanded = expandedPlatform === platformId;
            const items = getNavItems(platformId, isSystemAdmin, enabledFeatures);
            const accentColor = PLATFORM_COLORS[platformId];
            const isGloballyHidden = isSystemAdmin && globalPlatformVisibility && globalPlatformVisibility[platformId] === false;

            return (
              <div key={platformId}>
                <Link
                  href={`/${platformId}`}
                  onClick={(e) => {
                    if (expandedPlatform === platformId) {
                      // Already on this platform — just toggle expand/collapse
                      if (currentPlatform === platformId) {
                        e.preventDefault();
                        setExpandedPlatform(isExpanded ? null : platformId);
                        return;
                      }
                    }
                    setExpandedPlatform(platformId);
                    onNavigate?.();
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPlatform === platformId
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  style={{ borderLeft: `3px solid ${accentColor}` }}
                >
                  <span className="truncate">{PLATFORM_LABELS[platformId]}</span>
                  {(platformId === "canva" || platformId === "google_workspace") && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      Beta
                    </span>
                  )}
                  {isGloballyHidden && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Hidden
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0" />
                  )}
                </Link>
                {isExpanded && items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} isActive={isActive} badge={item.badge} adminOnly={item.adminOnly} className="pl-6" />
                  );
                })}
              </div>
            );
          })
        )}

        {/* Settings — always visible, below platforms */}
        <div className="border-t my-2" />
        <NavLink
          href="/settings"
          icon={Settings}
          label="Settings"
          isActive={pathname === "/settings" || pathname.startsWith("/settings/")}
        />

        {/* System Admin */}
        {isSystemAdmin && (
          <SystemAdminSection collapsed={collapsed} isAdminSection={isAdminSection} pathname={pathname} onNavigate={onNavigate} NavLink={NavLink} />
        )}
      </nav>
      {user && (
        <div className="border-t pt-3 mt-3">
          {impersonation?.isImpersonating && !collapsed && (
            <div className="px-3 py-1.5 text-xs text-amber-700 bg-amber-50 rounded-md mb-2 font-medium">
              Viewing as {impersonation.targetUser?.name}
            </div>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center py-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                {user.name} &middot; {account?.name} &middot; {user.role}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {account?.name} &middot; {user.role}
                </div>
              </div>
            </div>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className="flex items-center justify-center py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved !== null) setCollapsed(JSON.parse(saved));
    } catch {}
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
  }

  return (
    <aside className={`${collapsed ? "w-14" : "w-60"} border-r bg-muted/30 min-h-screen p-2 hidden md:flex flex-col transition-[width] duration-200`}>
      <SidebarContent
        collapsed={collapsed}
        showCollapseToggle
        onToggleCollapsed={toggleCollapsed}
      />
    </aside>
  );
}

function SystemAdminSection({ collapsed, isAdminSection, pathname, onNavigate, NavLink }: {
  collapsed: boolean;
  isAdminSection: boolean;
  pathname: string;
  onNavigate?: () => void;
  NavLink: any;
}) {
  const [adminExpanded, setAdminExpanded] = useState(isAdminSection);

  // Auto-expand when navigating to admin section
  useEffect(() => {
    if (isAdminSection) setAdminExpanded(true);
  }, [isAdminSection]);

  return (
    <>
      <div className="border-t my-2" />
      {collapsed ? (
        <NavLink href="/system-admin" icon={Shield} label="System Admin" isActive={isAdminSection} />
      ) : (
        <button
          onClick={() => {
            if (!isAdminSection && !adminExpanded) {
              // Not on admin page and not expanded — expand to show links
              setAdminExpanded(true);
            } else {
              setAdminExpanded(!adminExpanded);
            }
          }}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left ${
            isAdminSection
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Shield className="h-4 w-4" />
          System Admin
          {adminExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 ml-auto" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          )}
        </button>
      )}
      {adminExpanded && !collapsed &&
        systemAdminItems.map((item) => {
          const isActive =
            item.href === "/system-admin"
              ? pathname === "/system-admin"
              : pathname.startsWith(item.href);
          return (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} isActive={isActive} iconSize="h-3.5 w-3.5" className="pl-7 pr-3 py-1.5" />
          );
        })}
    </>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  function openSearch() {
    setOpen(false);
    // Small delay to let the sheet close before opening command palette
    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    }, 150);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-2">
          <VisuallyHidden.Root>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden.Root>
          {/* Search bar at the top of mobile sidebar */}
          <button
            onClick={openSearch}
            className="flex items-center gap-2 w-full px-3 py-2.5 mb-2 rounded-md border bg-muted/50 text-muted-foreground text-sm hover:bg-muted transition-colors min-h-[44px]"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>Search apps...</span>
            <kbd className="ml-auto text-[10px] font-mono bg-background border rounded px-1 py-0.5">⌘K</kbd>
          </button>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
