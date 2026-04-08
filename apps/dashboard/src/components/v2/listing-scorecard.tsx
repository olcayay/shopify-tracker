import { getMetadataLimits } from "@appranks/shared";
import { cn } from "@/lib/utils";

interface ScorecardCheck {
  label: string;
  status: "good" | "warning" | "missing";
  detail: string;
}

function computeChecks(snapshot: any, platform: string, app?: any): ScorecardCheck[] {
  const limits = getMetadataLimits(platform);
  const checks: ScorecardCheck[] = [];

  const addCheck = (label: string, value: string | null | undefined, limit: number) => {
    const len = (value || "").length;
    if (len === 0) {
      if (limit > 0) checks.push({ label, status: "missing", detail: "Missing" });
      return;
    }
    if (limit > 0 && len < limit * 0.3) {
      checks.push({ label, status: "warning", detail: `${len}/${limit} chars — too short` });
    } else if (limit > 0 && len > limit) {
      checks.push({ label, status: "warning", detail: `${len}/${limit} chars — over limit` });
    } else {
      checks.push({ label, status: "good", detail: limit > 0 ? `${len}/${limit} chars` : `${len} chars` });
    }
  };

  // name and appCardSubtitle live on the app object, not snapshot
  addCheck("Title", app?.name || snapshot?.name, limits.appName);
  addCheck("Subtitle", app?.appCardSubtitle || snapshot?.appCardSubtitle, limits.subtitle);
  addCheck("Introduction", snapshot?.appIntroduction, limits.introduction);
  addCheck("Description", snapshot?.appDetails, limits.details);

  // Features
  const features = snapshot?.features || snapshot?.platformData?.features || [];
  if (features.length > 0) {
    checks.push({ label: "Features", status: features.length >= 5 ? "good" : "warning", detail: `${features.length} listed` });
  } else {
    checks.push({ label: "Features", status: "missing", detail: "None" });
  }

  // SEO
  if (limits.seoTitle > 0) addCheck("SEO Title", snapshot?.seoTitle, limits.seoTitle);
  if (limits.seoMetaDescription > 0) addCheck("SEO Description", snapshot?.seoMetaDescription, limits.seoMetaDescription);

  return checks;
}

export function ListingScorecard({ snapshot, platform, app }: { snapshot: any; platform: string; app?: any }) {
  const checks = computeChecks(snapshot, platform, app);
  const goodCount = checks.filter((c) => c.status === "good").length;
  const completeness = checks.length > 0 ? Math.round((goodCount / checks.length) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Listing Completeness:</span>
        <div className="flex-1 max-w-xs h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              completeness >= 80 ? "bg-emerald-500" : completeness >= 50 ? "bg-amber-500" : "bg-red-500",
            )}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <span className="text-sm font-bold tabular-nums">{completeness}%</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-sm">
            <span className="w-4 text-center">
              {check.status === "good" && <span className="text-emerald-500">✓</span>}
              {check.status === "warning" && <span className="text-amber-500">⚠</span>}
              {check.status === "missing" && <span className="text-red-500">✗</span>}
            </span>
            <span className="font-medium">{check.label}</span>
            <span className="text-muted-foreground text-xs">— {check.detail}</span>
          </div>
        ))}
      </div>

      {app?.slug && (
        <a
          href={`/audit/${platform}/${app.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          View Full Audit →
        </a>
      )}
    </div>
  );
}
