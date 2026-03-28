export type SortKey = "order" | "name" | "similarity" | "rating" | "reviews" | "v7d" | "v30d" | "v90d" | "momentum" | "pricing" | "minPaidPrice" | "launchedDate" | "lastChange" | "featured" | "ads" | "ranked" | "similar" | "catRank" | "visibility" | "power";
export type SortDir = "asc" | "desc";

export const TOGGLEABLE_COLUMNS: { key: string; label: string; tip?: string }[] = [
  { key: "visibility", label: "Visibility", tip: "How discoverable this app is for your tracked keywords (0-100)" },
  { key: "power", label: "Power", tip: "Weighted aggregate market authority score (0-100)" },
  { key: "similarity", label: "Similarity", tip: "Similarity score based on categories, keywords, and text" },
  { key: "rating", label: "Rating" },
  { key: "reviews", label: "Reviews" },
  { key: "v7d", label: "R7d", tip: "Reviews received in the last 7 days" },
  { key: "v30d", label: "R30d", tip: "Reviews received in the last 30 days" },
  { key: "v90d", label: "R90d", tip: "Reviews received in the last 90 days" },
  { key: "momentum", label: "Momentum", tip: "Review growth trend: compares recent vs longer-term pace" },
  { key: "pricing", label: "Pricing" },
  { key: "minPaidPrice", label: "Min. Paid", tip: "Lowest paid plan price per month" },
  { key: "launchedDate", label: "Launched" },
  { key: "featured", label: "Featured", tip: "Number of featured sections this app appears in" },
  { key: "ads", label: "Ads", tip: "Number of keywords this app is running ads for" },
  { key: "ranked", label: "Ranked", tip: "Number of keywords this app ranks for in search results" },
  { key: "similar", label: "Similar", tip: "Number of other apps that list this app as similar" },
  { key: "catRank", label: "Category Rank", tip: "Average category ranking across all categories" },
  { key: "lastChange", label: "Last Change", tip: "Date of the most recent detected change in app listing" },
];
