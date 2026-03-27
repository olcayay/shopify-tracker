import { DashboardShell } from "@/components/dashboard-shell";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ImpersonationBanner />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
