import {
  TrendingDown,
  Eye,
  HelpCircle,
  EyeOff,
  Clock,
  Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const problems = [
  {
    icon: TrendingDown,
    title: "No Ranking History",
    description:
      "You can see your current category position, but there's no way to track how it changes over time — or what caused the change.",
  },
  {
    icon: Eye,
    title: "Manual Competitor Monitoring",
    description:
      "Checking if a competitor changed their pricing, added features, or gained reviews means visiting their listing every day.",
  },
  {
    icon: HelpCircle,
    title: "Keyword Guesswork",
    description:
      "You don't know which keywords drive traffic, where you rank for them, or who's advertising on them.",
  },
  {
    icon: EyeOff,
    title: "Invisible Featured Placements",
    description:
      "When Shopify features an app in a category or on the homepage, there's no record of it.",
  },
  {
    icon: Clock,
    title: "Time-Consuming Review Analysis",
    description:
      "Comparing review trends across your app and competitors requires spreadsheets and manual tracking.",
  },
  {
    icon: Timer,
    title: "Hours of Market Research",
    description:
      "Understanding category dynamics, competitive density, and market opportunities means crawling through hundreds of listings.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-20 bg-muted/30 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-bold text-center">
          The Shopify App Store is a Black Box
        </h2>
        <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto">
          Shopify provides no native analytics for developers. You&apos;re left
          guessing about your performance, your competitors, and your market.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem) => (
            <Card key={problem.title}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <problem.icon className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{problem.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {problem.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
