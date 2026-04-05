import { emailLayout, header } from "../../components/index.js";
import { colors } from "../../design-tokens.js";

export interface LoginAlertData {
  name: string;
  /** Device or user-agent description */
  device: string;
  /** Approximate location (e.g. "Istanbul, Turkey") */
  location?: string;
  /** IP address */
  ip?: string;
  /** ISO timestamp of the login */
  loginTime: string;
  /** URL to secure the account (change password, etc.) */
  secureAccountUrl: string;
}

export function loginAlertTemplate(data: LoginAlertData): { subject: string; html: string } {
  const time = new Date(data.loginTime).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  const body = `
    ${header("Security Alert")}
    <div style="padding:24px;">
      <p style="font-size:16px;line-height:1.6;color:#374151;">Hi ${data.name},</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;">
        We detected a new sign-in to your AppRanks account.
      </p>
      <div style="margin:20px 0;padding:20px;background:${colors.light};border-radius:8px;border-left:4px solid ${colors.amber};">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#374151;">
          <tr>
            <td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Time</td>
            <td style="padding:4px 0;">${time}</td>
          </tr>
          <tr>
            <td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Device</td>
            <td style="padding:4px 0;">${data.device}</td>
          </tr>
          ${data.location ? `<tr>
            <td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Location</td>
            <td style="padding:4px 0;">${data.location}</td>
          </tr>` : ""}
          ${data.ip ? `<tr>
            <td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">IP Address</td>
            <td style="padding:4px 0;font-family:ui-monospace,monospace;">${data.ip}</td>
          </tr>` : ""}
        </table>
      </div>
      <p style="font-size:16px;line-height:1.6;color:#374151;">
        If this was you, no action is needed.
      </p>
      <p style="font-size:16px;line-height:1.6;color:${colors.red};font-weight:600;">
        If this wasn't you, please
        <a href="${data.secureAccountUrl}" style="color:${colors.red};text-decoration:underline;">secure your account immediately</a>
        by changing your password.
      </p>
    </div>
    <div style="padding:24px;text-align:center;border-top:1px solid ${colors.border};color:${colors.darkMuted};font-size:12px;">
      <div>AppRanks &mdash; Multi-platform app marketplace intelligence</div>
    </div>
  `;

  return {
    subject: "New sign-in to your AppRanks account",
    html: emailLayout(body, "New sign-in detected"),
  };
}
