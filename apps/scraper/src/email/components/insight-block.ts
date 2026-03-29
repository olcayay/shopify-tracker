import { colors, sizes } from "../design-tokens.js";

/** AI-generated insight card with lightbulb icon */
export function insightBlock(text: string): string {
  return `
<div style="background:${colors.amberBg};border-left:4px solid ${colors.amber};padding:${sizes.paddingSmall};margin:${sizes.paddingSmall} 0;border-radius:0 ${sizes.borderRadius} ${sizes.borderRadius} 0;">
  <div style="font-size:13px;font-weight:600;color:${colors.amber};margin-bottom:4px;">&#128161; Insight</div>
  <div style="font-size:14px;color:${colors.dark};line-height:1.5;">${text}</div>
</div>`;
}
