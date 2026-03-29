import { colors, sizes } from "../design-tokens.js";

/** Large single-metric emphasis block (e.g., #3 → #1) */
export function heroStat(label: string, value: string, change?: { from: string; to: string; isPositive: boolean }): string {
  const changeColor = change?.isPositive ? colors.green : colors.red;
  return `
<div style="text-align:center;padding:${sizes.padding};">
  <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:${colors.darkMuted};margin-bottom:8px;">${label}</div>
  <div style="font-size:48px;font-weight:bold;color:${colors.dark};line-height:1;">${value}</div>
  ${change ? `<div style="font-size:16px;color:${changeColor};margin-top:8px;">${change.from} → ${change.to}</div>` : ""}
</div>`;
}
