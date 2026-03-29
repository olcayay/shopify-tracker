import { colors, sizes } from "../design-tokens.js";

interface BadgeItem {
  label: string;
  count: number;
  color: "green" | "red" | "blue" | "amber" | "purple";
}

/** Colored summary strip (e.g., "5 improved, 2 dropped, 1 new") */
export function summaryBadge(items: BadgeItem[]): string {
  const colorMap = {
    green: { bg: colors.greenBg, text: colors.green },
    red: { bg: colors.redBg, text: colors.red },
    blue: { bg: colors.blueBg, text: colors.blue },
    amber: { bg: colors.amberBg, text: colors.amber },
    purple: { bg: colors.purpleBg, text: colors.purple },
  };

  const badges = items
    .filter((i) => i.count > 0)
    .map((item) => {
      const c = colorMap[item.color];
      return `<span style="display:inline-block;padding:4px 12px;background:${c.bg};color:${c.text};border-radius:12px;font-size:13px;font-weight:600;margin:2px 4px;">${item.count} ${item.label}</span>`;
    })
    .join(" ");

  return `<div style="text-align:center;padding:${sizes.paddingSmall} 0;">${badges}</div>`;
}
