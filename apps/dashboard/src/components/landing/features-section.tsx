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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: AppWindow,
    title: "App Tracking & Monitoring",
    points: [
      "Track any app's details, pricing, ratings, and reviews",
      "Historical snapshots preserve every change",
      "Change detection for descriptions, features, and SEO",
    ],
  },
  {
    icon: Search,
    title: "Keyword Intelligence",
    points: [
      "Track keyword search positions over time",
      "Organic vs. sponsored result separation",
      "Ad sighting heatmaps with daily frequency data",
    ],
  },
  {
    icon: BarChart3,
    title: "Category Rankings",
    points: [
      "Full category tree with 5+ levels of depth",
      "Historical position tracking with trend charts",
      "Category percentile: Top X% of Y apps",
    ],
  },
  {
    icon: Swords,
    title: "Competitor Intelligence",
    points: [
      "Side-by-side competitor monitoring",
      "Review velocity comparison (7d, 30d, 90d)",
      "Multi-dimensional similarity scoring",
    ],
  },
  {
    icon: MessageSquareText,
    title: "Review Analytics",
    points: [
      "Rating and review count trend charts",
      "Velocity and acceleration metrics",
      "Momentum: Accelerating, Stable, Slowing, Spike, Flat",
    ],
  },
  {
    icon: Megaphone,
    title: "Featured & Ad Tracking",
    points: [
      "Monitor featured section appearances",
      "Keyword and category ad sighting heatmaps",
      "Historical ad frequency data",
    ],
  },
  {
    icon: GitCompare,
    title: "App Comparison",
    points: [
      "Side-by-side: descriptions, features, pricing",
      "Character count and content analysis",
      "Keyword density analysis with draft testing",
    ],
  },
  {
    icon: Compass,
    title: "Market Discovery",
    points: [
      "Browse by developer, integration, or category",
      "Similar app recommendations and connections",
      "Feature tracking across categories",
    ],
  },
  {
    icon: Users,
    title: "Team Collaboration",
    points: [
      "Multi-user accounts with role-based access",
      "Direct user creation and invitations",
      "Daily email digests with timezone support",
    ],
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-bold text-center">
          Everything You Need to Grow Your Shopify App
        </h2>
        <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto">
          From keyword tracking to competitor intelligence, AppRanks gives you
          the complete picture of your app&apos;s performance.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="relative">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{feature.title}</h3>
                <ul className="mt-3 space-y-2">
                  {feature.points.map((point) => (
                    <li
                      key={point}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-primary mt-1 shrink-0">
                        &bull;
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
