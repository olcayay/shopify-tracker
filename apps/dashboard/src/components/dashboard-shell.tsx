"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { IconSidebar } from "@/components/icon-sidebar";
import { MobileSidebar } from "@/components/sidebar";
import { PlatformDiscoverySheet } from "@/components/platform-discovery-sheet";
import { PlatformSwitcher } from "@/components/platform-switcher";
import { DashboardFooter } from "@/components/dashboard-footer";
import { isOnPlatformPage, isOnGlobalPage } from "@/lib/nav-utils";
import { useAuth } from "@/lib/auth-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { NotificationBell } from "@/components/notification-bell";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [trackedCount, setTrackedCount] = useState<number | null>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const isNavigating = useNavigationLoading();
  const showSidebar = isOnPlatformPage(pathname) || pathname.startsWith("/system-admin") || pathname.startsWith("/settings") || isOnGlobalPage(pathname) || !!user?.isSystemAdmin;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Desktop: TopBar */}
      <div className="hidden md:block">
        <TopBar onOpenDiscovery={() => setDiscoveryOpen(true)} trackedCount={trackedCount} />
      </div>
      {/* Mobile: hamburger + logo */}
      <header className="md:hidden flex items-center gap-3 border-b px-4 h-14 shrink-0">
        {showSidebar && <MobileSidebar />}
        <span className="flex items-center gap-1.5 font-semibold flex-1">
          <AnimatedLogo animating={isNavigating} />
          AppRanks
        </span>
        <NotificationBell />
      </header>
      <div className="flex flex-1 min-h-0">
        <IconSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
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
