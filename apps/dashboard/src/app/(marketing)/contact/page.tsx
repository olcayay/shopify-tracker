import type { Metadata } from "next";
import { Mail, MessageSquare, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the AppRanks team. We're here to help with any questions or feedback.",
};

const FAQ = [
  {
    q: "How do I track my first app?",
    a: "Go to your dashboard, use the search bar to find your app, and click 'Track' to start monitoring its marketplace performance.",
  },
  {
    q: "Which marketplaces are supported?",
    a: "AppRanks supports 11 marketplaces including Shopify, WordPress, Salesforce, Wix, HubSpot, Atlassian, Google Workspace, Zoom, Zoho, Zendesk, and Canva.",
  },
  {
    q: "Can I export my tracking data?",
    a: "Yes! Go to Settings and use the 'Download My Data' button to export your tracked apps and keywords as a JSON file. CSV export is also available.",
  },
  {
    q: "How often is data updated?",
    a: "Data is updated daily for all tracked apps. Keyword rankings and reviews are refreshed every 12-24 hours depending on the platform.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, you can cancel anytime from Settings > Billing. Your data will remain accessible until the end of your billing period.",
  },
];

export default function ContactPage() {
  return (
    <div className="py-16 px-4 md:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold">Contact Us</h1>
        <p className="mt-2 text-muted-foreground">
          Have a question, feedback, or need help? We&apos;d love to hear from you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Card>
            <CardHeader>
              <Mail className="h-6 w-6 text-primary mb-1" />
              <CardTitle className="text-base">Email Support</CardTitle>
              <CardDescription>
                Send us an email and we&apos;ll get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="mailto:support@appranks.io"
                className="text-primary hover:underline font-medium"
              >
                support@appranks.io
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-6 w-6 text-primary mb-1" />
              <CardTitle className="text-base">Feature Requests</CardTitle>
              <CardDescription>
                Have an idea for a new feature? Let us know what you&apos;d like to see.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="mailto:feedback@appranks.io"
                className="text-primary hover:underline font-medium"
              >
                feedback@appranks.io
              </a>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="font-medium">{item.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
