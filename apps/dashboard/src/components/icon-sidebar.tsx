"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { extractPlatform, getNavItems, systemAdminItems, isOnPlatformPage } from "@/lib/nav-utils";
import { type PlatformId } from "@appranks/shared";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function IconSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSystemAdmin = user?.isSystemAdmin;
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

  // For system admins on non-platform/non-admin pages, show admin items
  const showAdminFallback = isSystemAdmin && !isPlatformPage && !isAdminSection;

  const items = useMemo(
    () => (isAdminSection || showAdminFallback ? systemAdminItems : getNavItems(activePlatform, isSystemAdmin)),
    [activePlatform, isSystemAdmin, isAdminSection, showAdminFallback]
  );

  // Hide sidebar on non-platform, non-admin pages (unless system admin)
  if (!isPlatformPage && !isAdminSection && !isSystemAdmin) return null;

  const accentColor = isAdminSection || showAdminFallback ? undefined : display?.color;

  return (
    <aside
      className={`${expanded ? "w-48" : "w-14"} border-r bg-muted/30 sticky top-0 h-[calc(100vh-3.5rem)] hidden md:flex flex-col py-2 gap-1 shrink-0 transition-[width] duration-200 ease-in-out overflow-y-auto`}
    >
      {/* System Admin header */}
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
          ? { backgroundColor: accentColor, color: "white" }
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
                  ? activeStyle ?? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
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

      {/* Spacer */}
      <div className="flex-1" />

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
