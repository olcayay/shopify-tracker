"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { PLATFORMS, isPlatformId } from "@appranks/shared";
import type { AuditReport as AuditReportType, AuditSection, AuditCheck, AuditRecommendation, PlatformId } from "@appranks/shared";
import { cn } from "@/lib/utils";
import { displayPricingModel } from "@/lib/pricing-display";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Download,
  Loader2,
  Type,
  FileText,
  Image,
  Tags,
  Settings,
  Globe,
} from "lucide-react";

const SECTION_ICONS: Record<string, React.ElementType> = {
  Type,
  FileText,
  Image,
  Tags,
  Settings,
  Globe,
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 70) return "stroke-emerald-500";
  if (score >= 40) return "stroke-amber-500";
  return "stroke-red-500";
}

// --- Score Circle ---
function ScoreCircle({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-700", scoreBg(score))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold", scoreColor(score))}>{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// --- Check Item ---
function CheckItem({ check }: { check: AuditCheck }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-shrink-0 mt-0.5">
        {check.status === "pass" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {check.status === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
        {check.status === "fail" && <XCircle className="h-4 w-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{check.label}</span>
          <span className="text-xs text-muted-foreground">— {check.detail}</span>
        </div>
        {check.recommendation && (
          <p className="text-xs text-muted-foreground mt-0.5">{check.recommendation}</p>
        )}
      </div>
    </div>
  );
}

// --- Section Card ---
function SectionCard({ section }: { section: AuditSection }) {
  const [isOpen, setIsOpen] = useState(true);
  const Icon = SECTION_ICONS[section.icon] || FileText;

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <span className="font-semibold flex-1">{section.name}</span>
        <span className={cn("text-lg font-bold tabular-nums", scoreColor(section.score))}>
          {section.score}
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t divide-y">
          {section.checks.map((check) => (
            <CheckItem key={check.id} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Impact Badge ---
function ImpactBadge({ impact }: { impact: string }) {
  const styles = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", styles[impact as keyof typeof styles] || styles.low)}>
      {impact}
    </span>
  );
}

// --- Main Report ---
export function AuditReport({ report, platform }: { report: AuditReportType; platform: string }) {
  const platformConfig = isPlatformId(platform) ? PLATFORMS[platform] : null;
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const el = reportRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgWidth = 190; // A4 width minus margins (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");

      // If content is taller than one page, split across pages
      const pageHeight = 277; // A4 height minus margins
      let yOffset = 0;

      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          10, // x margin
          10 - yOffset, // y position (shifts up for subsequent pages)
          imgWidth,
          imgHeight,
        );
        yOffset += pageHeight;
      }

      const slug = report.app.slug || "app";
      pdf.save(`${slug}-audit-${report.overallScore}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [report, isExporting]);

  return (
    <div className="space-y-8">
      {/* Back link + Download */}
      <div className="flex items-center justify-between">
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>
        <button
          onClick={handleDownloadPdf}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-accent transition-colors disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? "Exporting..." : "Download PDF"}
        </button>
      </div>

      <div ref={reportRef} className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {report.app.iconUrl ? (
          <img
            src={report.app.iconUrl}
            alt={report.app.name}
            className="w-16 h-16 rounded-xl object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-muted" />
        )}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold">{report.app.name}</h1>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-sm text-muted-foreground">
            {platformConfig && <span>{platformConfig.name}</span>}
            {report.app.developer && (
              <>
                <span>·</span>
                <span>{report.app.developer}</span>
              </>
            )}
            {report.app.averageRating && (
              <>
                <span>·</span>
                <span>
                  {"\u2605"} {Number(report.app.averageRating).toFixed(1)}
                  {report.app.ratingCount ? ` (${report.app.ratingCount})` : ""}
                </span>
              </>
            )}
            {report.app.pricingHint && (
              <>
                <span>·</span>
                <span>{displayPricingModel(report.app.pricingHint)}</span>
              </>
            )}
          </div>
        </div>
        <ScoreCircle score={report.overallScore} />
      </div>

      {/* Score Breakdown */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Score Breakdown</h2>
        {report.sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recommendations</h2>
          <div className="rounded-lg border bg-card divide-y">
            {report.recommendations.map((rec) => (
              <div key={rec.index} className="p-4 flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {rec.index}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{rec.title}</span>
                    <ImpactBadge impact={rec.impact} />
                    <span className="text-xs text-muted-foreground">{rec.section}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>{/* end reportRef */}

      {/* CTA Footer */}
      <div className="rounded-lg border bg-card p-6 text-center space-y-3">
        <h3 className="font-semibold">Want to track your ranking daily?</h3>
        <p className="text-sm text-muted-foreground">
          Get alerts when your ranking changes, monitor competitors, and discover keyword opportunities.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Start Tracking Free
        </Link>
      </div>

      {/* Generated at */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(report.generatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
    </div>
  );
}
