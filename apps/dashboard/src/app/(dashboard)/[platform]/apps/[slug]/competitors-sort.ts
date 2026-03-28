import type { SortKey, SortDir } from "./competitors-section-types";

export function getSortedCompetitors(
  competitors: any[],
  sortKey: SortKey,
  sortDir: SortDir,
  selfPinned: boolean,
  lastChanges: Record<string, string>,
): any[] {
  if (sortKey === "order") return competitors; // preserve API order
  const pinnedSelf = selfPinned ? competitors.filter((c) => c.isSelf) : [];
  const rest = selfPinned ? competitors.filter((c) => !c.isSelf) : [...competitors];
  return [...pinnedSelf, ...rest.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = (a.appName || a.appSlug).localeCompare(b.appName || b.appSlug);
        break;
      case "similarity":
        cmp = parseFloat(a.similarityScore?.overall ?? "0") - parseFloat(b.similarityScore?.overall ?? "0");
        break;
      case "rating":
        cmp = (a.latestSnapshot?.averageRating ?? 0) - (b.latestSnapshot?.averageRating ?? 0);
        break;
      case "reviews":
        cmp = (a.latestSnapshot?.ratingCount ?? 0) - (b.latestSnapshot?.ratingCount ?? 0);
        break;
      case "v7d":
        cmp = (a.reviewVelocity?.v7d ?? -Infinity) - (b.reviewVelocity?.v7d ?? -Infinity);
        break;
      case "v30d":
        cmp = (a.reviewVelocity?.v30d ?? -Infinity) - (b.reviewVelocity?.v30d ?? -Infinity);
        break;
      case "v90d":
        cmp = (a.reviewVelocity?.v90d ?? -Infinity) - (b.reviewVelocity?.v90d ?? -Infinity);
        break;
      case "momentum": {
        const order: Record<string, number> = { spike: 5, accelerating: 4, stable: 3, slowing: 2, flat: 1 };
        cmp = (order[a.reviewVelocity?.momentum ?? ""] ?? 0) - (order[b.reviewVelocity?.momentum ?? ""] ?? 0);
        break;
      }
      case "pricing":
        cmp = (a.latestSnapshot?.pricing || "").localeCompare(b.latestSnapshot?.pricing || "");
        break;
      case "minPaidPrice":
        cmp = (a.minPaidPrice ?? 0) - (b.minPaidPrice ?? 0);
        break;
      case "launchedDate":
        cmp = (a.launchedDate || "").localeCompare(b.launchedDate || "");
        break;
      case "lastChange":
        cmp = (lastChanges[a.appSlug] || "").localeCompare(lastChanges[b.appSlug] || "");
        break;
      case "featured":
        cmp = (a.featuredSections ?? 0) - (b.featuredSections ?? 0);
        break;
      case "ads":
        cmp = (a.adKeywords ?? 0) - (b.adKeywords ?? 0);
        break;
      case "ranked":
        cmp = (a.rankedKeywordCount ?? 0) - (b.rankedKeywordCount ?? 0);
        break;
      case "similar":
        cmp = (a.reverseSimilarCount ?? 0) - (b.reverseSimilarCount ?? 0);
        break;
      case "catRank": {
        const avgRank = (comp: any) => {
          const rankings = comp.categoryRankings ?? [];
          if (!rankings.length) return Infinity;
          let sum = 0;
          let count = 0;
          for (const cr of rankings) {
            if (cr.position != null) {
              sum += cr.position;
              count++;
            }
          }
          return count > 0 ? sum / count : Infinity;
        };
        cmp = avgRank(a) - avgRank(b);
        break;
      }
      case "visibility":
        cmp = (a.visibilityScore ?? -1) - (b.visibilityScore ?? -1);
        break;
      case "power":
        cmp = (a.weightedPowerScore ?? -1) - (b.weightedPowerScore ?? -1);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  })];
}
