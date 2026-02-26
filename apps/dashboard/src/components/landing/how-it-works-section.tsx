import {
  Plus,
  Search,
  UserPlus,
  Star,
  LayoutDashboard,
  Mail,
  type LucideIcon,
} from "lucide-react";

const steps: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Plus,
    title: "Add Your Apps",
    description: "Search and start tracking with one click.",
  },
  {
    icon: Search,
    title: "Set Up Keywords",
    description: "We track your search positions automatically.",
  },
  {
    icon: UserPlus,
    title: "Add Competitors",
    description: "Monitor them side-by-side with your app.",
  },
  {
    icon: Star,
    title: "Star Categories",
    description: "Bookmark what matters most to you.",
  },
  {
    icon: LayoutDashboard,
    title: "Watch Your Dashboard",
    description: "Everything updated continuously, 24/7.",
  },
  {
    icon: Mail,
    title: "Get Daily Digests",
    description: "Key changes delivered to your inbox.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-muted/30 px-4 md:px-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center">
          Up and Running in 5 Minutes
        </h2>
        <p className="mt-4 text-center text-muted-foreground text-lg">
          No complex setup. No learning curve. Just results.
        </p>

        <div className="mt-14 relative">
          {/* Vertical connector line (desktop) */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />

          <div className="space-y-8 md:space-y-0">
            {steps.map((step, index) => {
              const isLeft = index % 2 === 0;
              return (
                <div
                  key={step.title}
                  className={`md:grid md:grid-cols-2 md:gap-12 relative ${
                    index > 0 ? "md:mt-0" : ""
                  }`}
                >
                  {/* Desktop: alternating sides */}
                  <div
                    className={`md:py-6 ${
                      isLeft ? "md:text-right md:pr-12" : "md:col-start-2 md:pl-12"
                    }`}
                  >
                    {/* Mobile layout */}
                    <div className="flex items-start gap-4 md:block">
                      <div
                        className={`shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm md:hidden`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 md:justify-end">
                          {isLeft && (
                            <h3 className="font-semibold text-lg hidden md:block">
                              {step.title}
                            </h3>
                          )}
                          <step.icon className="h-4 w-4 text-muted-foreground hidden md:block" />
                          {!isLeft && (
                            <h3 className="font-semibold text-lg hidden md:block">
                              {step.title}
                            </h3>
                          )}
                          <h3 className="font-semibold md:hidden">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Center dot (desktop) */}
                  <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary text-primary-foreground items-center justify-center font-bold text-sm shadow-md shadow-primary/20 z-10">
                    {index + 1}
                  </div>

                  {/* Spacer for alternating layout */}
                  {isLeft && <div className="hidden md:block" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
