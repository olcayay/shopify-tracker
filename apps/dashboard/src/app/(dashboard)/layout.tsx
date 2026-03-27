import { TopBar } from "@/components/top-bar";
import { IconSidebar } from "@/components/icon-sidebar";
import { MobileSidebar } from "@/components/sidebar";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ImpersonationBanner />
      <div className="flex flex-col min-h-screen">
        {/* Desktop: TopBar always visible */}
        <div className="hidden md:block">
          <TopBar />
        </div>
        {/* Mobile: hamburger + logo */}
        <header className="md:hidden flex items-center gap-3 border-b px-4 h-14 shrink-0">
          <MobileSidebar />
          <span className="font-semibold">AppRanks</span>
        </header>
        <div className="flex flex-1 min-h-0">
          <IconSidebar />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
