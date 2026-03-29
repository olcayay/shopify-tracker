import { emailLayout, header, ctaButton } from "../../components/index.js";
import { colors } from "../../design-tokens.js";

export interface InvitationData {
  inviterName: string;
  accountName: string;
  acceptUrl: string;
  /** Role being invited to (e.g. "member", "admin") */
  role?: string;
}

export function invitationTemplate(data: InvitationData): { subject: string; html: string } {
  const roleText = data.role ? ` as ${data.role === "admin" ? "an admin" : `a ${data.role}`}` : "";

  const body = `
    ${header("Team Invitation")}
    <div style="padding:24px;">
      <p style="font-size:16px;line-height:1.6;color:#374151;">Hello,</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;">
        <strong>${data.inviterName}</strong> has invited you to join
        <strong>${data.accountName}</strong>${roleText} on AppRanks.
      </p>
      <div style="margin:24px 0;padding:20px;background:${colors.light};border-radius:8px;text-align:center;">
        <div style="font-size:14px;color:${colors.darkMuted};margin-bottom:4px;">You've been invited to</div>
        <div style="font-size:20px;font-weight:600;color:${colors.dark};">${data.accountName}</div>
      </div>
      ${ctaButton("Accept Invitation", data.acceptUrl)}
      <p style="font-size:14px;line-height:1.6;color:${colors.darkMuted};">
        This invitation will allow you to access the team's tracked apps, keywords, and competitive intelligence data.
        If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </div>
    <div style="padding:24px;text-align:center;border-top:1px solid ${colors.border};color:${colors.darkMuted};font-size:12px;">
      <div>AppRanks &mdash; Multi-platform app marketplace intelligence</div>
    </div>
  `;

  return {
    subject: `${data.inviterName} invited you to join ${data.accountName} on AppRanks`,
    html: emailLayout(body, `Join ${data.accountName} on AppRanks`),
  };
}
