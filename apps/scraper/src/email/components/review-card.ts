import { colors, sizes } from "../design-tokens.js";

/** Review quote card with star rating and author */
export function reviewCard(rating: number, author: string, content: string, date?: string): string {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const starColor = rating >= 4 ? colors.amber : rating >= 3 ? colors.darkMuted : colors.red;

  return `
<div style="background:${colors.light};border-radius:${sizes.borderRadius};padding:${sizes.paddingSmall};margin:8px 0;">
  <div style="color:${starColor};font-size:16px;letter-spacing:2px;">${stars}</div>
  <div style="font-size:14px;color:${colors.dark};margin:8px 0;line-height:1.5;">"${content}"</div>
  <div style="font-size:12px;color:${colors.darkMuted};">— ${author}${date ? ` &bull; ${date}` : ""}</div>
</div>`;
}
