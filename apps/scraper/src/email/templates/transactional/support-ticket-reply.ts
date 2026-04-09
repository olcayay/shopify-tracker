import { emailLayout, header, ctaButton } from "../../components/index.js";
import { colors } from "../../design-tokens.js";

export interface SupportTicketReplyData {
  name: string;
  ticketNumber: number;
  ticketSubject: string;
  adminName: string;
  replyPreview: string;
  ticketUrl: string;
}

export function supportTicketReplyTemplate(data: SupportTicketReplyData): { subject: string; html: string } {
  const body = `
    ${header("New Reply on Your Support Ticket")}
    <div style="padding:24px;">
      <p style="font-size:16px;line-height:1.6;color:#374151;">Hi ${data.name},</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;">
        ${data.adminName} has replied to your support ticket <strong>#${data.ticketNumber}</strong>:
      </p>
      <div style="margin:16px 0;padding:16px;background:${colors.light};border-left:3px solid ${colors.primary};border-radius:4px;">
        <p style="font-size:14px;font-weight:600;color:#374151;margin:0 0 4px;">${data.ticketSubject}</p>
        <p style="font-size:14px;line-height:1.6;color:${colors.darkMuted};margin:0;white-space:pre-wrap;">
          ${data.replyPreview}
        </p>
      </div>
      ${ctaButton("View Ticket", data.ticketUrl)}
      <p style="font-size:14px;line-height:1.6;color:${colors.darkMuted};">
        You can reply directly from the ticket page. Our team typically responds within 24 hours.
      </p>
    </div>
    <div style="padding:24px;text-align:center;border-top:1px solid ${colors.border};color:${colors.darkMuted};font-size:12px;">
      <div>AppRanks &mdash; Multi-platform app marketplace intelligence</div>
    </div>
  `;

  return {
    subject: `Re: [#${data.ticketNumber}] ${data.ticketSubject}`,
    html: emailLayout(body, `Re: [#${data.ticketNumber}] ${data.ticketSubject}`),
  };
}
