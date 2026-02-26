import {
  AppWindow,
  Search,
  BarChart3,
  Swords,
  MessageSquareText,
  Megaphone,
  GitCompare,
  Compass,
  Users,
  type LucideIcon,
} from "lucide-react";

const features: {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
}[] = [
  {
    icon: AppWindow,
    title: "App Tracking",
    description:
      "Track any app's details, pricing, ratings, and reviews. Historical snapshots preserve every change.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Search,
    title: "Keyword Intelligence",
    description:
      "Track search positions over time. See organic vs. sponsored results and ad sighting heatmaps.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: BarChart3,
    title: "Category Rankings",
    description:
      "Full category tree with position history, rank changes, and percentile rankings.",
    gradient: "from-emerald-500 to-green-500",
  },
  {
    icon: Swords,
    title: "Competitor Intel",
    description:
      "Side-by-side monitoring with review velocity comparison and similarity scoring.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: MessageSquareText,
    title: "Review Analytics",
    description:
      "Rating trends, velocity metrics, and momentum analysis — Accelerating, Stable, Slowing, or Spike.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: Megaphone,
    title: "Ad Tracking",
    description:
      "Monitor featured placements and ad sightings with calendar heatmaps and frequency data.",
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    icon: GitCompare,
    title: "App Comparison",
    description:
      "Compare descriptions, features, pricing side-by-side with keyword density analysis.",
    gradient: "from-teal-500 to-cyan-500",
  },
  {
    icon: Compass,
    title: "Market Discovery",
    description:
      "Browse by developer, integration, or category. Find similar apps and market opportunities.",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Multi-user accounts with roles, direct invitations, and daily email digests.",
    gradient: "from-fuchsia-500 to-pink-500",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center">
          Your Unfair Advantage
        </h2>
        <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto text-lg">
          9 powerful tools in one dashboard. Everything you need to outrank,
          outsmart, and outgrow your competitors.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              {/* Gradient top border on hover */}
              <div
                className={`absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-gradient-to-r ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />
              <div
                className={`w-11 h-11 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-sm`}
              >
                <feature.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
