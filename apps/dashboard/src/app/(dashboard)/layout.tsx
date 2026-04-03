import { DashboardShell } from "@/components/dashboard-shell";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { SuspensionBanner } from "@/components/suspension-banner";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { GracePeriodBanner } from "@/components/grace-period-banner";
import { OverLimitBanner } from "@/components/over-limit-banner";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ImpersonationBanner />
      <SuspensionBanner />
      <EmailVerificationBanner />
      <GracePeriodBanner />
      <OverLimitBanner />
      <DashboardShell>{children}</DashboardShell>
      <OnboardingWizard />
    </>
  );
}
