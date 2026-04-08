import type { Metadata } from "next";
import { AuditSearch } from "@/components/audit/audit-search";

export const metadata: Metadata = {
  title: "Free App Listing Audit | AppRanks",
  description:
    "Get an instant score with actionable recommendations for your app store listing. Analyze title, description, visuals, categories, and more.",
  openGraph: {
    title: "Free App Listing Audit | AppRanks",
    description:
      "Get an instant score with actionable recommendations for your app store listing.",
    type: "website",
  },
};

export default function AuditPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* Hero */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          See how your app listing stacks up
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Get a free, instant audit with a score out of 100 and actionable
          recommendations to improve your listing&apos;s visibility and conversions.
        </p>
      </div>

      {/* Search */}
      <AuditSearch />

      {/* How it works */}
      <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        <div className="space-y-2">
          <div className="text-3xl font-bold text-primary">1</div>
          <h3 className="font-semibold">Search your app</h3>
          <p className="text-sm text-muted-foreground">
            Type your app name and select it from the results.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-primary">2</div>
          <h3 className="font-semibold">Get your score</h3>
          <p className="text-sm text-muted-foreground">
            We analyze 6 key areas: title, content, visuals, categories,
            technical setup, and languages.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-primary">3</div>
          <h3 className="font-semibold">Follow recommendations</h3>
          <p className="text-sm text-muted-foreground">
            Get prioritized, actionable advice to improve your listing.
          </p>
        </div>
      </div>
    </div>
  );
}
