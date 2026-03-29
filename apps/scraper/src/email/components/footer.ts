import { colors, sizes } from "../design-tokens.js";

/** Email footer with unsubscribe and preferences links */
export function footer(unsubscribeUrl?: string, preferencesUrl?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://appranks.io";
  const prefsLink = preferencesUrl || `${baseUrl}/settings`;
  const unsubLink = unsubscribeUrl || `${baseUrl}/unsubscribe`;

  return `
<div style="padding:${sizes.padding};text-align:center;border-top:1px solid ${colors.border};color:${colors.darkMuted};font-size:12px;">
  <div style="margin-bottom:8px;">
    <a href="${prefsLink}" style="color:${colors.darkMuted};text-decoration:underline;">Email Preferences</a>
    &nbsp;&bull;&nbsp;
    <a href="${unsubLink}" style="color:${colors.darkMuted};text-decoration:underline;">Unsubscribe</a>
  </div>
  <div>AppRanks &mdash; Multi-platform app marketplace intelligence</div>
</div>`;
}
