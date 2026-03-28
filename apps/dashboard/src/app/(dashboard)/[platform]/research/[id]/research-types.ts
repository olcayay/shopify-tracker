// ─── Types ───────────────────────────────────────────────────

export interface ResearchData {
  project: { id: string; name: string; createdAt: string; updatedAt: string };
  keywords: { id: number; keyword: string; slug: string; totalResults: number | null; scrapedAt: string | null }[];
  competitors: {
    slug: string; name: string; iconUrl: string | null;
    averageRating: number | null; ratingCount: number | null;
    pricingHint: string | null; minPaidPrice: number | null;
    powerScore: number | null; categories: any[]; features: string[];
    categoryRankings: { slug: string; breadcrumb: string; position: number; totalApps: number | null }[];
    launchedAt: string | null;
    featuredSections: number;
    reverseSimilarCount: number;
    externalId?: string | null;
  }[];
  keywordRankings: Record<string, Record<string, number>>;
  competitorSuggestions: {
    slug: string; name: string; iconUrl: string | null;
    averageRating: number | null; ratingCount: number | null;
    matchedKeywords: string[]; matchedCount: number; avgPosition: number;
  }[];
  keywordSuggestions: {
    keyword: string; slug?: string; competitorCount: number;
    bestPosition?: number; source: "ranking" | "metadata";
  }[];
  wordAnalysis: { word: string; totalScore: number; appCount: number; sources: Record<string, number> }[];
  categories: {
    slug: string; title: string; competitorCount: number; total: number;
    competitors: { slug: string; position: number }[];
  }[];
  featureCoverage: {
    feature: string; title: string; count: number; total: number;
    competitors: string[]; isGap: boolean;
    categoryType?: string; categoryTitle?: string; subcategoryTitle?: string;
  }[];
  opportunities: {
    keyword: string; slug: string; opportunityScore: number;
    room: number; demand: number; competitorCount: number; totalResults: number | null;
  }[];
  virtualApps: {
    id: string; researchProjectId: string; name: string;
    icon: string; color: string; iconUrl: string | null;
    appCardSubtitle: string; appIntroduction: string; appDetails: string;
    seoTitle: string; seoMetaDescription: string;
    features: string[]; integrations: string[]; languages: string[];
    categories: any[]; pricingPlans: any[];
    generatedByAi?: boolean;
    creatorName?: string | null;
    createdAt: string; updatedAt: string;
  }[];
}

// ─── Utilities ───────────────────────────────────────────────

export function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function toSlug(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
