import {
  History,
  RefreshCw,
  Gauge,
  Layers,
  Target,
  Bell,
  LayoutDashboard,
  type LucideIcon,
  Check,
} from "lucide-react";

const differentiators: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: History,
    title: "Complete Historical Data",
    description:
      "Every data point stored as a snapshot. Understand trends and the impact of your changes.",
  },
  {
    icon: RefreshCw,
    title: "24/7 Automated Monitoring",
    description:
      "Categories daily, app details every 12h, keywords every 12h, reviews daily.",
  },
  {
    icon: Gauge,
    title: "Review Momentum Analysis",
    description:
      "Not just counts — know if reviews are accelerating, stable, or slowing.",
  },
  {
    icon: Layers,
    title: "Multi-Dimensional Similarity",
    description:
      "Compare across categories, features, keywords, and content — not a single number.",
  },
  {
    icon: Target,
    title: "Ad Intelligence",
    description:
      "See who's spending on keyword and category ads, how often, and on which days.",
  },
  {
    icon: Bell,
    title: "Change Detection",
    description:
      "Instant alerts when competitors update descriptions, pricing, features, or SEO.",
  },
  {
    icon: LayoutDashboard,
    title: "All-in-One Platform",
    description:
      "Rankings, reviews, keywords, competitors, ads — no more juggling multiple tools.",
  },
];

export function DifferentiatorsSection() {
  return (
    <section className="py-20 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">
            Why Teams Choose AppRanks
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Built for developers who are serious about growing their Shopify app business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {differentiators.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40"
            >
              <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
