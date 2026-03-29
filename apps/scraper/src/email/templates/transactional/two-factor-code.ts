import { emailLayout, header } from "../../components/index.js";
import { colors, fonts } from "../../design-tokens.js";

export interface TwoFactorCodeData {
  name: string;
  code: string;
  /** Expiry time in minutes (default: 10) */
  expiryMinutes?: number;
}

export function twoFactorCodeTemplate(data: TwoFactorCodeData): { subject: string; html: string } {
  const expiryMinutes = data.expiryMinutes ?? 10;

  const body = `
    ${header("Verification Code")}
    <div style="padding:24px;">
      <p style="font-size:16px;line-height:1.6;color:#374151;">Hi ${data.name},</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;">
        Your verification code is:
      </p>
      <div style="margin:24px 0;text-align:center;">
        <div style="display:inline-block;padding:16px 40px;background:${colors.light};border:2px solid ${colors.border};border-radius:8px;font-family:${fonts.mono};font-size:32px;font-weight:700;letter-spacing:8px;color:${colors.dark};">
          ${data.code}
        </div>
      </div>
      <p style="font-size:14px;line-height:1.6;color:${colors.darkMuted};text-align:center;">
        This code expires in ${expiryMinutes} minute${expiryMinutes > 1 ? "s" : ""}.
      </p>
      <p style="font-size:14px;line-height:1.6;color:${colors.darkMuted};">
        If you didn't request this code, someone may be trying to access your account.
        Please change your password immediately.
      </p>
    </div>
    <div style="padding:24px;text-align:center;border-top:1px solid ${colors.border};color:${colors.darkMuted};font-size:12px;">
      <div>AppRanks &mdash; Multi-platform app marketplace intelligence</div>
    </div>
  `;

  return {
    subject: `${data.code} is your AppRanks verification code`,
    html: emailLayout(body, `Your verification code: ${data.code}`),
  };
}
