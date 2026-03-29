import { colors, sizes } from "../design-tokens.js";

/** Primary or secondary call-to-action button */
export function ctaButton(text: string, url: string, variant: "primary" | "secondary" = "primary"): string {
  const bg = variant === "primary" ? colors.primary : "transparent";
  const textColor = variant === "primary" ? colors.white : colors.primary;
  const border = variant === "secondary" ? `2px solid ${colors.primary}` : "none";

  return `
<div style="text-align:center;padding:${sizes.paddingSmall} 0;">
  <a href="${url}" style="display:inline-block;padding:12px 32px;background:${bg};color:${textColor};border:${border};border-radius:6px;font-weight:600;font-size:15px;text-decoration:none;">
    ${text}
  </a>
</div>`;
}
