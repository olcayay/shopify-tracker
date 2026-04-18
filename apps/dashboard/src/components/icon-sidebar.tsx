"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { extractPlatform, getNavItems, systemAdminItems, globalNavItems, isOnPlatformPage, isOnGlobalPage } from "@/lib/nav-utils";
import { type PlatformId } from "@appranks/shared";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarTrackedApps } from "@/components/sidebar-tracked-apps";

export function IconSidebar() {
  const pathname = usePathname();
  const { user, account } = useAuth();
  const isSystemAdmin = user?.isSystemAdmin;
  const enabledFeatures = account?.enabledFeatures ?? [];
  const isAdminSection = pathname.startsWith("/system-admin");
  const isPlatformPage = isOnPlatformPage(pathname);

  const [expanded, setExpanded] = useState(false);

  // Persist expanded state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("icon-sidebar-expanded");
      if (saved !== null) setExpanded(JSON.parse(saved));
    } catch {}
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("icon-sidebar-expanded", JSON.stringify(next));
  }

  const activePlatform = extractPlatform(pathname);
  const display = PLATFORM_DISPLAY[activePlatform];

  const isGlobalPage = isOnGlobalPage(pathname);
  const isSettingsPage = pathname.startsWith("/settings");
  // For system admins on non-platform/non-admin/non-global/non-settings pages, show admin items
  const showAdminFallback = isSystemAdmin && !isPlatformPage && !isAdminSection && !isGlobalPage && !isSettingsPage;

  // Filter global nav items by feature flags (e.g. hide Notifications when flag is off)
  const filteredGlobalNav = useMemo(
    () => globalNavItems.filter((item) => item.href !== "/notifications" || enabledFeatures.includes("notifications")),
    [enabledFeatures]
  );

  const items = useMemo(
    () => {
      if (isAdminSection || showAdminFallback) return systemAdminItems;
      if (isGlobalPage || isSettingsPage) return filteredGlobalNav;
      return getNavItems(activePlatform, isSystemAdmin, enabledFeatures);
    },
    [activePlatform, isSystemAdmin, isAdminSection, showAdminFallback, isGlobalPage, isSettingsPage, enabledFeatures, filteredGlobalNav]
  );

  // Show sidebar on platform pages, admin pages, global pages, settings, or for system admins
  if (!isPlatformPage && !isAdminSection && !isGlobalPage && !isSettingsPage && !isSystemAdmin) return null;

  const accentColor = isAdminSection || showAdminFallback || isGlobalPage || isSettingsPage ? undefined : display?.color;

  return (
    <aside
      className={`${expanded ? "w-48" : "w-14"} border-r bg-muted/30 sticky top-0 h-[calc(100vh-3.5rem)] hidden md:flex flex-col py-2 gap-1 shrink-0 transition-[width] duration-200 ease-in-out overflow-y-auto`}
    >
      {/* System Admin header (only on admin section or fallback, not global pages) */}
      {(isAdminSection || showAdminFallback) && (
        <>
          {expanded ? (
            <Link
              href="/system-admin"
              className="flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium text-amber-600 mb-1"
            >
              <Shield className="h-4 w-4 shrink-0" />
              System Admin
            </Link>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/system-admin"
                  className="h-9 w-9 mx-auto flex items-center justify-center rounded-md mb-1 text-amber-600"
                >
                  <Shield className="h-4.5 w-4.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">System Admin</TooltipContent>
            </Tooltip>
          )}
          <div className={`${expanded ? "mx-3" : "mx-auto w-6"} border-t mb-1`} />
        </>
      )}

      {/* Nav items */}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/system-admin"
            ? pathname === "/system-admin"
            : item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

        const activeStyle = isActive && accentColor
          ? { backgroundColor: accentColor, color: "var(--primary-foreground)" }
          : undefined;

        if (expanded) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              style={
                isActive
                  ? activeStyle ?? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
                  : undefined
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {item.badge}
                </span>
              )}
              {item.adminOnly && (
                <Shield className="h-3 w-3 ml-auto text-amber-500 shrink-0" />
              )}
            </Link>
          );
        }

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className={`h-9 w-9 mx-auto flex items-center justify-center rounded-md text-sm transition-colors relative ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                style={activeStyle}
              >
                <Icon className="h-4 w-4" />
                {item.badge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              {item.label}
              {item.adminOnly && " (Admin)"}
              {item.badge && ` (${item.badge})`}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Tracked apps */}
      {isPlatformPage && (
        <>
          <div className={`${expanded ? "mx-3" : "mx-auto w-6"} border-t my-1`} />
          <SidebarTrackedApps
            platform={activePlatform}
            collapsed={!expanded}
          />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Persistent System Admin link (visible on platform/global pages where admin nav isn't shown) */}
      {isSystemAdmin && !isAdminSection && !showAdminFallback && (
        <>
          <div className={`${expanded ? "mx-3" : "mx-auto w-6"} border-t mb-1`} />
          {expanded ? (
            <Link
              href="/system-admin"
              className="flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-md text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span className="truncate">System Admin</span>
            </Link>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/system-admin"
                  className="h-9 w-9 mx-auto flex items-center justify-center rounded-md text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                >
                  <Shield className="h-4.5 w-4.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">System Admin</TooltipContent>
            </Tooltip>
          )}
        </>
      )}

      {/* Toggle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleExpanded}
            className={`${expanded ? "mx-2 px-2.5" : "mx-auto"} h-9 ${expanded ? "w-auto" : "w-9"} flex items-center ${expanded ? "gap-2.5" : "justify-center"} rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors`}
          >
            {expanded ? (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span className="text-xs">Collapse</span>
              </>
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
        </TooltipTrigger>
        {!expanded && <TooltipContent side="right">Expand sidebar</TooltipContent>}
      </Tooltip>
    </aside>
  );
}
