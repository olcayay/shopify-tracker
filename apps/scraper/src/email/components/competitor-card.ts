import { colors, sizes } from "../design-tokens.js";

interface CompetitorData {
  name: string;
  iconUrl?: string;
  rating?: number | null;
  ratingCount?: number | null;
  keywordPositions?: number;
  change?: string;
}

/** Competitor summary card */
export function competitorCard(competitor: CompetitorData): string {
  const icon = competitor.iconUrl
    ? `<img src="${competitor.iconUrl}" width="32" height="32" style="border-radius:6px;vertical-align:middle;margin-right:8px;" alt="">`
    : "";

  return `
<div style="border:1px solid ${colors.border};border-radius:${sizes.borderRadius};padding:${sizes.paddingSmall};margin:8px 0;">
  <div style="font-size:15px;font-weight:600;color:${colors.dark};">${icon}${competitor.name}</div>
  <div style="margin-top:8px;font-size:13px;color:${colors.darkMuted};">
    ${competitor.rating != null ? `&#9733; ${competitor.rating}${competitor.ratingCount ? ` (${competitor.ratingCount})` : ""}` : ""}
    ${competitor.keywordPositions ? ` &bull; ${competitor.keywordPositions} keywords ranked` : ""}
  </div>
  ${competitor.change ? `<div style="margin-top:6px;font-size:13px;color:${colors.amber};font-weight:500;">${competitor.change}</div>` : ""}
</div>`;
}
