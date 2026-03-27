"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { extractPlatform, getNavItems, systemAdminItems } from "@/lib/nav-utils";
import { type PlatformId } from "@appranks/shared";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function IconSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSystemAdmin = user?.isSystemAdmin;
  const isAdminSection = pathname.startsWith("/system-admin");

  const activePlatform = extractPlatform(pathname);
  const display = PLATFORM_DISPLAY[activePlatform];

  const items = useMemo(
    () => (isAdminSection ? systemAdminItems : getNavItems(activePlatform, isSystemAdmin)),
    [activePlatform, isSystemAdmin, isAdminSection]
  );

  // Accent color: platform brand color or neutral for admin
  const accentColor = isAdminSection ? undefined : display?.color;

  return (
    <aside className="w-14 border-r bg-muted/30 min-h-0 hidden md:flex flex-col items-center py-2 gap-1 shrink-0">
      {/* System Admin header icon when in admin section */}
      {isAdminSection && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/system-admin"
                className="h-9 w-9 flex items-center justify-center rounded-md mb-1 text-amber-600"
              >
                <Shield className="h-4.5 w-4.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">System Admin</TooltipContent>
          </Tooltip>
          <div className="w-6 border-t mb-1" />
        </>
      )}

      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/system-admin"
            ? pathname === "/system-admin"
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className={`h-9 w-9 flex items-center justify-center rounded-md text-sm transition-colors relative ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                style={
                  isActive && accentColor
                    ? { backgroundColor: accentColor, color: "white" }
                    : undefined
                }
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
    </aside>
  );
}
