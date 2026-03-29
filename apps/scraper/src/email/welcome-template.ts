/**
 * Welcome email and onboarding series templates.
 */
import {
  emailLayout,
  header,
  ctaButton,
  footer,
} from "./components/index.js";

export interface WelcomeEmailData {
  userName: string;
  accountName: string;
  step: "welcome" | "day2" | "day7";
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

const TEMPLATES: Record<string, { subject: string; heading: string; body: string; cta: { text: string; url: string } }> = {
  welcome: {
    subject: "Welcome to AppRanks! Let's get started",
    heading: "Welcome to AppRanks! 🎉",
    body: `
      <p style="font-size:16px;line-height:1.6;color:#374151;">You're now set up to track app rankings, monitor competitors, and discover opportunities across 11 marketplaces.</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;"><strong>Here's how to get the most out of AppRanks:</strong></p>
      <ol style="font-size:15px;line-height:1.8;color:#374151;padding-left:20px;">
        <li><strong>Track your apps</strong> — Add your apps to start monitoring rankings</li>
        <li><strong>Add keywords</strong> — Track the search terms that matter most</li>
        <li><strong>Set up competitors</strong> — Keep an eye on what the competition is doing</li>
        <li><strong>Enable alerts</strong> — Get notified when rankings change</li>
      </ol>
    `,
    cta: { text: "Go to Dashboard", url: DASHBOARD_URL },
  },
  day2: {
    subject: "Have you tracked your first keyword?",
    heading: "Day 2: Track Your Keywords 🔍",
    body: `
      <p style="font-size:16px;line-height:1.6;color:#374151;">Keywords are the backbone of app store visibility. Tracking them helps you understand where users find your app — and your competitors.</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;"><strong>Tips for choosing keywords:</strong></p>
      <ul style="font-size:15px;line-height:1.8;color:#374151;padding-left:20px;">
        <li>Start with your app's main use case (e.g., "email marketing")</li>
        <li>Add competitor brand names to track their rankings</li>
        <li>Include category-specific terms</li>
      </ul>
    `,
    cta: { text: "Add Keywords", url: `${DASHBOARD_URL}/shopify/keywords` },
  },
  day7: {
    subject: "Your first week with AppRanks — what's next?",
    heading: "Week 1 Complete! 📊",
    body: `
      <p style="font-size:16px;line-height:1.6;color:#374151;">You've been using AppRanks for a week. By now, you should have ranking data flowing in and competitors mapped out.</p>
      <p style="font-size:16px;line-height:1.6;color:#374151;"><strong>Next steps to level up:</strong></p>
      <ul style="font-size:15px;line-height:1.8;color:#374151;padding-left:20px;">
        <li>Review your daily digest emails for ranking trends</li>
        <li>Check the competitor comparison view for market positioning</li>
        <li>Set up keyword alerts for your most important terms</li>
        <li>Explore category rankings to find new opportunities</li>
      </ul>
    `,
    cta: { text: "View Your Rankings", url: `${DASHBOARD_URL}/overview` },
  },
};

export function buildWelcomeHtml(data: WelcomeEmailData, unsubscribeUrl?: string): string {
  const template = TEMPLATES[data.step];

  const content = `
    ${header(template.heading, data.accountName)}
    <div style="padding:0 24px 24px;">
      <p style="font-size:16px;color:#374151;">Hi ${data.userName},</p>
      ${template.body}
      ${ctaButton(template.cta.text, template.cta.url)}
    </div>
    ${footer(unsubscribeUrl)}
  `;

  return emailLayout(content, `Welcome to AppRanks, ${data.userName}!`);
}

export function buildWelcomeSubject(data: WelcomeEmailData): string {
  return TEMPLATES[data.step].subject;
}
