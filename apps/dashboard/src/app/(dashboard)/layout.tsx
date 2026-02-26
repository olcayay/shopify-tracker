import { Sidebar, MobileSidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center gap-3 border-b px-4 h-14 shrink-0">
          <MobileSidebar />
          <span className="font-semibold">AppRanks</span>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
