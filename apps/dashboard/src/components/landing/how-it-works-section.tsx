import {
  Plus,
  Search,
  UserPlus,
  Star,
  LayoutDashboard,
  Mail,
} from "lucide-react";

const steps = [
  {
    icon: Plus,
    title: "Add Your Apps",
    description: "Search for your Shopify app and start tracking with one click.",
  },
  {
    icon: Search,
    title: "Set Up Keywords",
    description:
      "Add keywords to monitor — AppRanks tracks your position automatically.",
  },
  {
    icon: UserPlus,
    title: "Add Competitors",
    description: "Select competitor apps to monitor side-by-side with yours.",
  },
  {
    icon: Star,
    title: "Star Categories",
    description:
      "Bookmark the categories and features most relevant to your business.",
  },
  {
    icon: LayoutDashboard,
    title: "Check Your Dashboard",
    description:
      "Rankings, reviews, competitor activity — updated continuously.",
  },
  {
    icon: Mail,
    title: "Get Daily Digests",
    description:
      "Email summaries delivered to your team with the most important changes.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-muted/30 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-bold text-center">
          Get Started in Minutes
        </h2>
        <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto">
          Set up your tracking in minutes and start getting insights right away.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                {index + 1}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <step.icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
