import type { Metadata } from "next";
import { Rocket, Sparkles, Bug } from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Product updates, new features, and improvements for AppRanks.",
};

interface ChangelogEntry {
  date: string;
  title: string;
  type: "feature" | "improvement" | "fix";
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-04-03",
    title: "Pre-release polish",
    type: "improvement",
    items: [
      "Added command palette (Cmd+K) for quick navigation",
      "Onboarding wizard for new users",
      "Billing section in settings with plan status",
      "Password strength indicator on register and reset pages",
      "Loading skeletons for all dashboard pages",
      "Keyboard shortcuts help modal (press ?)",
      "Admin audit log, DLQ monitoring, and scraper stats pages",
    ],
  },
  {
    date: "2026-04-02",
    title: "Security & performance",
    type: "improvement",
    items: [
      "HTTP security headers (HSTS, X-Frame-Options, CSP)",
      "Account lockout after 10 failed login attempts",
      "Refresh token device fingerprinting",
      "Redis-backed rate limiting with X-RateLimit headers",
      "Gzip response compression",
      "8 new database indexes for query optimization",
      "Toast notifications for user actions",
    ],
  },
  {
    date: "2026-04-01",
    title: "Core auth & infrastructure",
    type: "feature",
    items: [
      "Password reset flow (forgot password + reset page)",
      "Email verification system",
      "Account deletion with GDPR data export",
      "Sentry error tracking on frontend",
      "SEO: sitemap, robots.txt, Open Graph images",
      "Pricing page with plan comparison",
      "CSV export for tracked apps and keywords",
    ],
  },
];

const TYPE_CONFIG = {
  feature: { icon: Rocket, label: "New Feature", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30" },
  improvement: { icon: Sparkles, label: "Improvement", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" },
  fix: { icon: Bug, label: "Fix", color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30" },
};

export default function ChangelogPage() {
  return (
    <div className="py-16 px-4 md:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold">Changelog</h1>
        <p className="mt-2 text-muted-foreground">
          Product updates, new features, and improvements.
        </p>

        <div className="mt-10 space-y-12">
          {CHANGELOG.map((entry) => {
            const config = TYPE_CONFIG[entry.type];
            const Icon = config.icon;
            return (
              <article key={entry.date + entry.title}>
                <div className="flex items-center gap-3 mb-3">
                  <time className="text-sm font-mono text-muted-foreground">
                    {entry.date}
                  </time>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </span>
                </div>
                <h2 className="text-xl font-semibold">{entry.title}</h2>
                <ul className="mt-3 space-y-1.5">
                  {entry.items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
