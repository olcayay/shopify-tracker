import { Sidebar } from "@/components/sidebar";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <AdminScraperTrigger />
        {children}
      </main>
    </div>
  );
}
