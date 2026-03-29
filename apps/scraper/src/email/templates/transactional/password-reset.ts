import { emailLayout, header, ctaButton } from "../../components/index.js";
import { colors } from "../../design-tokens.js";

export interface PasswordResetData {
  name: string;
  resetUrl: string;
  /** Expiry time in hours (default: 1) */
  expiryHours?: number;
}

export function passwordResetTemplate(data: PasswordResetData): { subject: string; html: string } {
  const expiryHours = data.expiryHours ?? 1;

  const body = `
    ${header("Password Reset")}
    <div style="padding:24px;">
      <p style="font-size:16px;line-height:1.6;color:#374151;">Hi ${data.name},</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;">
        We received a request to reset the password for your AppRanks account.
        Click the button below to create a new password.
      </p>
      ${ctaButton("Reset Your Password", data.resetUrl)}
      <p style="font-size:14px;line-height:1.6;color:${colors.darkMuted};">
        This link will expire in ${expiryHours} hour${expiryHours > 1 ? "s" : ""}.
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not be changed.
      </p>
      <div style="margin-top:24px;padding:16px;background:${colors.light};border-radius:6px;">
        <p style="font-size:13px;color:${colors.darkMuted};margin:0;">
          If the button above doesn't work, copy and paste this URL into your browser:
        </p>
        <p style="font-size:13px;color:${colors.primary};word-break:break-all;margin:8px 0 0;">
          ${data.resetUrl}
        </p>
      </div>
    </div>
    <div style="padding:24px;text-align:center;border-top:1px solid ${colors.border};color:${colors.darkMuted};font-size:12px;">
      <div>AppRanks &mdash; Multi-platform app marketplace intelligence</div>
    </div>
  `;

  return {
    subject: "Reset your AppRanks password",
    html: emailLayout(body, "Reset your password"),
  };
}
