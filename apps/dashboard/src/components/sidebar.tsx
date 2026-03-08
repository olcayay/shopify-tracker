"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderTree,
  AppWindow,
  Search,
  Star,
  Puzzle,
  Settings,
  Shield,
  LogOut,
  User,
  Users,
  Bot,
  KeyRound,
  Package,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FlaskConical,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";

const PLATFORM_LABELS: Record<PlatformId, string> = {
  shopify: "Shopify",
  salesforce: "Salesforce",
  canva: "Canva",
};

const PLATFORM_COLORS: Record<PlatformId, string> = {
  shopify: "#95BF47",
  salesforce: "#00A1E0",
  canva: "#00C4CC",
};

function getNavItems(platformId: PlatformId) {
  const p = `/${platformId}`;
  const caps = PLATFORMS[platformId];
  const items: { href: string; label: string; icon: any; badge?: string }[] = [
    { href: `${p}/overview`, label: "Overview", icon: LayoutDashboard },
    { href: `${p}/apps`, label: "Apps", icon: AppWindow },
    { href: `${p}/competitors`, label: "Competitors", icon: Star },
  ];
  if (caps.hasKeywordSearch) {
    items.push({ href: `${p}/keywords`, label: "Keywords", icon: Search });
  }
  items.push({ href: `${p}/categories`, label: "Categories", icon: FolderTree });
  if (caps.hasFeaturedSections) {
    items.push({ href: `${p}/featured`, label: "Featured", icon: Sparkles });
  }
  if (caps.hasFeatureTaxonomy) {
    items.push({ href: `${p}/features`, label: "Features", icon: Puzzle });
  }
  items.push({ href: `${p}/research`, label: "Research", icon: FlaskConical, badge: "Beta" });
  return items;
}

const systemAdminItems = [
  { href: "/system-admin", label: "Overview", icon: Shield },
  { href: "/system-admin/accounts", label: "Accounts", icon: Users },
  { href: "/system-admin/users", label: "Users", icon: User },
  { href: "/system-admin/apps", label: "Apps", icon: AppWindow },
  { href: "/system-admin/keywords", label: "Keywords", icon: KeyRound },
  { href: "/system-admin/features", label: "Features", icon: Puzzle },
  { href: "/system-admin/researches", label: "Research", icon: FlaskConical },
  { href: "/system-admin/packages", label: "Packages", icon: Package },
  { href: "/system-admin/scraper", label: "Scraper", icon: Bot },
];

/** Extract platform from current pathname */
function extractPlatform(pathname: string): PlatformId {
  const match = pathname.match(/^\/(shopify|salesforce|canva)(\/|$)/);
  return (match?.[1] as PlatformId) ?? "shopify";
}

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
  const { user, account, logout, impersonation } = useAuth();
  const isSystemAdmin = user?.isSystemAdmin;
  const isAdminSection = pathname.startsWith("/system-admin");

  const currentPlatform = extractPlatform(pathname);
  const [expandedPlatform, setExpandedPlatform] = useState<PlatformId | null>(currentPlatform);

  // Sync expanded platform when URL changes
  useEffect(() => {
    setExpandedPlatform(currentPlatform);
  }, [currentPlatform]);

  function NavLink({ href, icon: Icon, label, isActive, iconSize = "h-4 w-4", className = "", badge }: {
    href: string; icon: any; label: string; isActive: boolean; iconSize?: string; className?: string; badge?: string;
  }) {
    const content = (
      <Link
        href={href}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-md text-sm transition-colors ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2"} ${className} ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className={`${iconSize} shrink-0`} />
        {!collapsed && label}
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
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return content;
  }

  // In collapsed mode, just show the active platform's nav icons
  const activePlatformItems = useMemo(() => getNavItems(currentPlatform), [currentPlatform]);

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
          /* Collapsed: show active platform's nav icons only */
          activePlatformItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} isActive={isActive} badge={item.badge} />
            );
          })
        ) : (
          /* Expanded: platform accordion */
          (Object.keys(PLATFORMS) as PlatformId[]).map((platformId) => {
            const isExpanded = expandedPlatform === platformId;
            const items = getNavItems(platformId);
            const accentColor = PLATFORM_COLORS[platformId];

            return (
              <div key={platformId}>
                <Link
                  href={`/${platformId}/overview`}
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
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0" />
                  )}
                </Link>
                {isExpanded && items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} isActive={isActive} badge={item.badge} className="pl-6" />
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
          <>
            <div className="border-t my-2" />
            {collapsed ? (
              <NavLink href="/system-admin" icon={Shield} label="System Admin" isActive={isAdminSection} />
            ) : (
              <Link
                href="/system-admin"
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isAdminSection
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shield className="h-4 w-4" />
                System Admin
                {isAdminSection ? (
                  <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                )}
              </Link>
            )}
            {isAdminSection && !collapsed &&
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

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 p-2">
          <VisuallyHidden.Root>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden.Root>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
