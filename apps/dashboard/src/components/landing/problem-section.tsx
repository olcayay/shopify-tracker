import {
  TrendingDown,
  Eye,
  HelpCircle,
  EyeOff,
  Clock,
  Timer,
  type LucideIcon,
} from "lucide-react";

const problems: { icon: LucideIcon; title: string; description: string; emoji: string }[] = [
  {
    icon: TrendingDown,
    emoji: "📉",
    title: "No Ranking History",
    description:
      "Where were you ranked last week? Last month? No idea.",
  },
  {
    icon: Eye,
    emoji: "🕵️",
    title: "Manual Competitor Monitoring",
    description:
      "Checking competitor listings every day? That's not a strategy, that's a chore.",
  },
  {
    icon: HelpCircle,
    emoji: "🎯",
    title: "Keyword Guesswork",
    description:
      "You don't know which keywords drive installs — or who's advertising on them.",
  },
  {
    icon: EyeOff,
    emoji: "👻",
    title: "Invisible Featured Placements",
    description:
      "Shopify featured your competitor and you didn't even notice.",
  },
  {
    icon: Clock,
    emoji: "📊",
    title: "Spreadsheet Hell",
    description:
      "Tracking reviews in a spreadsheet? There has to be a better way. (There is.)",
  },
  {
    icon: Timer,
    emoji: "⏰",
    title: "Hours of Market Research",
    description:
      "Crawling through hundreds of listings to understand your market? Not anymore.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-20 bg-muted/30 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center">
          Sound Familiar?
        </h2>
        <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto text-lg">
          The Shopify App Store gives you zero analytics.
          You&apos;re flying blind.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="group rounded-xl border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30"
            >
              <div className="text-3xl mb-3">{problem.emoji}</div>
              <h3 className="font-semibold text-lg">{problem.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
