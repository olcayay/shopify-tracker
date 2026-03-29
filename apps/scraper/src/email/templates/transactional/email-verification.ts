import { emailLayout, header, ctaButton } from "../../components/index.js";
import { colors } from "../../design-tokens.js";

export interface EmailVerificationData {
  name: string;
  verificationUrl: string;
}

export function emailVerificationTemplate(data: EmailVerificationData): { subject: string; html: string } {
  const body = `
    ${header("Email Verification")}
    <div style="padding:24px;">
      <p style="font-size:16px;line-height:1.6;color:#374151;">Hi ${data.name},</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;">
        Please verify your email address to complete your AppRanks account setup.
      </p>
      ${ctaButton("Verify Email Address", data.verificationUrl)}
      <p style="font-size:14px;line-height:1.6;color:${colors.darkMuted};">
        If you didn't create an AppRanks account, you can safely ignore this email.
      </p>
      <div style="margin-top:24px;padding:16px;background:${colors.light};border-radius:6px;">
        <p style="font-size:13px;color:${colors.darkMuted};margin:0;">
          If the button above doesn't work, copy and paste this URL into your browser:
        </p>
        <p style="font-size:13px;color:${colors.primary};word-break:break-all;margin:8px 0 0;">
          ${data.verificationUrl}
        </p>
      </div>
    </div>
    <div style="padding:24px;text-align:center;border-top:1px solid ${colors.border};color:${colors.darkMuted};font-size:12px;">
      <div>AppRanks &mdash; Multi-platform app marketplace intelligence</div>
    </div>
  `;

  return {
    subject: "Verify your AppRanks email address",
    html: emailLayout(body, "Verify your email address"),
  };
}
