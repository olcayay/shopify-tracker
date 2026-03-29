import { colors, sizes } from "../design-tokens.js";

/** Celebration block for wins/milestones */
export function milestoneCard(title: string, description: string): string {
  return `
<div style="background:linear-gradient(135deg, ${colors.purpleBg}, ${colors.blueBg});border:2px solid ${colors.primary};border-radius:${sizes.borderRadius};padding:${sizes.padding};text-align:center;margin:${sizes.paddingSmall} 0;">
  <div style="font-size:32px;margin-bottom:8px;">&#127942;</div>
  <div style="font-size:18px;font-weight:bold;color:${colors.primary};margin-bottom:4px;">${title}</div>
  <div style="font-size:14px;color:${colors.dark};line-height:1.5;">${description}</div>
</div>`;
}
