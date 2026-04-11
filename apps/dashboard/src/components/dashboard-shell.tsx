"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { IconSidebar } from "@/components/icon-sidebar";
import { MobileSidebar } from "@/components/sidebar";
import { PlatformDiscoverySheet } from "@/components/platform-discovery-sheet";
import { PlatformSwitcher } from "@/components/platform-switcher";
import { DashboardFooter } from "@/components/dashboard-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { isOnPlatformPage, isOnGlobalPage, extractPlatform } from "@/lib/nav-utils";
import { useAuth } from "@/lib/auth-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { NotificationBell } from "@/components/notification-bell";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [trackedCount, setTrackedCount] = useState<number | null>(null);
  const pathname = usePathname();
  const { user, account } = useAuth();
  const isNavigating = useNavigationLoading();
  const showSidebar = isOnPlatformPage(pathname) || pathname.startsWith("/system-admin") || pathname.startsWith("/settings") || isOnGlobalPage(pathname) || !!user?.isSystemAdmin;

  const activePlatform = extractPlatform(pathname);
  const isPlatformPage = isOnPlatformPage(pathname);
  const display = isPlatformPage ? PLATFORM_DISPLAY[activePlatform] : null;

  function openCommandPalette() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Desktop: TopBar */}
      <div className="hidden md:block">
        <TopBar onOpenDiscovery={() => setDiscoveryOpen(true)} trackedCount={trackedCount} />
      </div>
      {/* Mobile: enhanced header with search, platform indicator, theme */}
      <header className="md:hidden flex items-center gap-2 border-b px-3 h-14 shrink-0">
        {showSidebar && <MobileSidebar />}
        <span className="flex items-center gap-1.5 font-semibold">
          <AnimatedLogo animating={isNavigating} />
          AppRanks
        </span>

        {/* Active platform indicator */}
        {display && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: display.color }}
            />
            <span className="max-w-[80px] truncate">{display.label}</span>
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <button
          onClick={openCommandPalette}
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Search apps"
          aria-label="Search apps"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        {(user?.isSystemAdmin || account?.enabledFeatures?.includes("notifications")) && <NotificationBell />}
      </header>
      <div className="flex flex-1 min-h-0">
        <IconSidebar />
        <main className="flex-1 min-w-0 max-w-full p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>

      <DashboardFooter />

      <PlatformDiscoverySheet
        open={discoveryOpen}
        onOpenChange={setDiscoveryOpen}
        onTrackedCountChange={setTrackedCount}
      />
      <PlatformSwitcher />
    </div>
  );
}
