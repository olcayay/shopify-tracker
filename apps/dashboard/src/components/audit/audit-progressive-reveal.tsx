"use client";

import { useState, useCallback } from "react";
import { AuditLoading } from "./audit-loading";
import { AuditReport } from "./audit-report";
import type { AuditReport as AuditReportType } from "@appranks/shared";

interface AuditProgressiveRevealProps {
  report: AuditReportType;
  platform: string;
}

export function AuditProgressiveReveal({
  report,
  platform,
}: AuditProgressiveRevealProps) {
  const [phase, setPhase] = useState<"loading" | "reveal">("loading");

  const handleLoadingComplete = useCallback(() => {
    setPhase("reveal");
  }, []);

  if (phase === "loading") {
    return (
      <AuditLoading
        appName={report.app.name}
        appIconUrl={report.app.iconUrl}
        onComplete={handleLoadingComplete}
      />
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <AuditReport report={report} platform={platform} />
    </div>
  );
}
