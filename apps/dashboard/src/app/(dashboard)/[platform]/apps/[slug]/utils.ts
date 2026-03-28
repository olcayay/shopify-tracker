export function relativeDate(dateStr: string): string {
  const date = new Date(
    /[Zz]$/.test(dateStr) || /[+-]\d{2}(:\d{2})?$/.test(dateStr)
      ? dateStr
      : dateStr.replace(" ", "T") + "Z"
  );
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function computeRankingChanges(
  rankings: any[],
  slugKey: string,
  labelKey: string,
): { slug: string; label: string; position: number; prevPosition: number | null; delta: number }[] {
  const grouped = new Map<string, any[]>();
  for (const r of rankings) {
    if (r.position == null || r.position < 0) continue;
    const key = r[slugKey];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  const results: { slug: string; label: string; position: number; prevPosition: number | null; delta: number }[] = [];
  for (const [key, entries] of grouped) {
    entries.sort((a: any, b: any) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    const latest = entries[0];
    const prev = entries.length > 1 ? entries[1] : null;
    const delta = prev ? prev.position - latest.position : 0;
    results.push({
      slug: key,
      label: latest[labelKey],
      position: latest.position,
      prevPosition: prev?.position ?? null,
      delta,
    });
  }
  return results;
}

export function getFieldLabels(platform: string): Record<string, string> {
  const isCanva = platform === "canva";
  const isWix = platform === "wix";
  const isWordPress = platform === "wordpress";
  const isGoogleWorkspace = platform === "google_workspace";
  const isAtlassian = platform === "atlassian";
  const isHubSpot = platform === "hubspot";
  return {
    name: "App Name",
    appIntroduction: isAtlassian ? "Summary" : isCanva || isWix || isWordPress || isGoogleWorkspace || isHubSpot ? "Short Description" : "Introduction",
    appDetails: isCanva || isWix || isWordPress || isGoogleWorkspace || isAtlassian || isHubSpot ? "Description" : "Details",
    features: "Features",
    seoTitle: "SEO Title",
    seoMetaDescription: "SEO Description",
    appCardSubtitle: isAtlassian ? "Tag Line" : isCanva || isWix ? "Tagline" : isWordPress || isGoogleWorkspace || isHubSpot ? "Short Description" : "Subtitle",
  };
}

export const FIELD_COLORS: Record<string, string> = {
  name: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  appIntroduction: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  appDetails: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  features: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  seoTitle: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  seoMetaDescription: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  appCardSubtitle: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
};
