import {
  History,
  RefreshCw,
  Gauge,
  Layers,
  Target,
  Bell,
  LayoutDashboard,
} from "lucide-react";

const differentiators = [
  {
    icon: History,
    title: "Complete Historical Data",
    description:
      "Every data point is stored as a snapshot. Look back to understand trends, seasonality, and the impact of your changes.",
  },
  {
    icon: RefreshCw,
    title: "Automated 24/7 Monitoring",
    description:
      "Data collection runs continuously — categories daily, app details every 12h, keywords every 12h, reviews daily.",
  },
  {
    icon: Gauge,
    title: "Review Momentum",
    description:
      "Not just review counts. Know if acquisition is accelerating, stable, or slowing — and compare against competitors.",
  },
  {
    icon: Layers,
    title: "Multi-Dimensional Similarity",
    description:
      "Understand competitor similarity across categories, features, keywords, and content — not a single number.",
  },
  {
    icon: Target,
    title: "Ad Intelligence",
    description:
      "See which competitors spend on keyword and category ads, how often, and on which days.",
  },
  {
    icon: Bell,
    title: "Real-Time Change Detection",
    description:
      "Field-level tracking catches every modification to competitor listings — descriptions, pricing, features, SEO.",
  },
  {
    icon: LayoutDashboard,
    title: "All-in-One Platform",
    description:
      "Rankings, reviews, keywords, competitors, ads, featured placements — everything in a single dashboard.",
  },
];

export function DifferentiatorsSection() {
  return (
    <section className="py-20 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: headline */}
          <div>
            <h2 className="text-3xl font-bold">Why AppRanks?</h2>
            <p className="mt-4 text-muted-foreground">
              Built specifically for Shopify app developers who want to stop
              guessing and start making data-driven decisions about their app
              business.
            </p>
          </div>

          {/* Right: list */}
          <div className="space-y-6">
            {differentiators.map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
