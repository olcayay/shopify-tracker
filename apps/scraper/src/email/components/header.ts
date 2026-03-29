import { colors, sizes } from "../design-tokens.js";

/** Email header with AppRanks branding and type label */
export function header(emailTypeLabel: string, date?: string): string {
  const dateStr = date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `
<div style="background:${colors.primary};padding:${sizes.padding};text-align:center;">
  <div style="font-size:24px;font-weight:bold;color:${colors.white};letter-spacing:-0.5px;">AppRanks</div>
  <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">${emailTypeLabel}</div>
  <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;">${dateStr}</div>
</div>`;
}
