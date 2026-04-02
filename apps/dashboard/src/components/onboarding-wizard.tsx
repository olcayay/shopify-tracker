"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Search, BarChart3, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const STEPS = [
  {
    icon: Rocket,
    title: "Welcome to AppRanks!",
    description: "Track your app's marketplace performance across 11 platforms. Let's get you started in 3 quick steps.",
  },
  {
    icon: Search,
    title: "Track your first app",
    description: "Search for your app on any marketplace and start tracking its rankings, reviews, and competitors.",
    action: "Go to Apps",
    href: "/overview",
  },
  {
    icon: BarChart3,
    title: "Monitor keywords",
    description: "Track keywords that matter to your business. See where you rank and discover opportunities.",
    action: "Explore Keywords",
    href: "/overview",
  },
] as const;

const STORAGE_KEY = "appranks_onboarding_dismissed";

export function OnboardingWizard() {
  const { user, account } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(true); // default hidden

  useEffect(() => {
    // Show only for new users (account has 0 usage and not dismissed)
    if (!user || !account) return;
    const wasDismissed = localStorage.getItem(STORAGE_KEY);
    if (wasDismissed) return;

    const usage = account.usage;
    const isNew = usage.trackedApps === 0 && usage.trackedKeywords === 0;
    if (isNew) setDismissed(false);
  }, [user, account]);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (dismissed || !user) return null;

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-background p-8 shadow-xl">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>

          <h2 className="text-xl font-semibold">{currentStep.title}</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {currentStep.description}
          </p>

          {/* Progress dots */}
          <div className="flex gap-1.5 py-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button onClick={dismiss}>
                Get Started
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : "action" in currentStep ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => setStep(step + 1)}>
                Let&apos;s go
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          <button onClick={dismiss} className="text-xs text-muted-foreground hover:underline">
            Skip, I&apos;ll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
