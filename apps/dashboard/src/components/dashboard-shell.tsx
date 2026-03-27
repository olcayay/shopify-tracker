"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { IconSidebar } from "@/components/icon-sidebar";
import { MobileSidebar } from "@/components/sidebar";
import { PlatformDiscoverySheet } from "@/components/platform-discovery-sheet";
import { PlatformSwitcher } from "@/components/platform-switcher";
import { DashboardFooter } from "@/components/dashboard-footer";
import { isOnPlatformPage } from "@/lib/nav-utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const pathname = usePathname();
  const showSidebar = isOnPlatformPage(pathname) || pathname.startsWith("/system-admin");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Desktop: TopBar */}
      <div className="hidden md:block">
        <TopBar onOpenDiscovery={() => setDiscoveryOpen(true)} />
      </div>
      {/* Mobile: hamburger + logo */}
      <header className="md:hidden flex items-center gap-3 border-b px-4 h-14 shrink-0">
        {showSidebar && <MobileSidebar />}
        <span className="font-semibold">AppRanks</span>
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
      />
      <PlatformSwitcher />
    </div>
  );
}
