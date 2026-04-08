"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLoadingProps {
  appName: string;
  appIconUrl?: string | null;
  onComplete: () => void;
}

const STEPS = [
  { label: "Fetching listing data", duration: 1500 },
  { label: "Analyzing title & description", duration: 2000 },
  { label: "Checking visuals & screenshots", duration: 2000 },
  { label: "Evaluating categories & setup", duration: 1500 },
  { label: "Generating recommendations", duration: 2000 },
];

type StepStatus = "pending" | "active" | "complete";

export function AuditLoading({ appName, appIconUrl, onComplete }: AuditLoadingProps) {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    STEPS.map(() => "pending")
  );

  useEffect(() => {
    let totalDelay = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((step, i) => {
      // Set step to active
      timers.push(
        setTimeout(() => {
          setStepStatuses((prev) => {
            const next = [...prev];
            next[i] = "active";
            return next;
          });
        }, totalDelay)
      );

      totalDelay += step.duration;

      // Set step to complete
      timers.push(
        setTimeout(() => {
          setStepStatuses((prev) => {
            const next = [...prev];
            next[i] = "complete";
            return next;
          });
        }, totalDelay)
      );
    });

    // Call onComplete after all steps
    timers.push(setTimeout(onComplete, totalDelay + 500));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in duration-500">
      {/* App header */}
      <div className="flex items-center gap-3">
        {appIconUrl ? (
          <img src={appIconUrl} alt="" className="w-12 h-12 rounded-xl" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-muted" />
        )}
        <div>
          <h2 className="text-xl font-bold">{appName}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing listing...
          </span>
        </div>
      </div>

      {/* Steps checklist */}
      <div className="w-full max-w-sm space-y-3">
        {STEPS.map((step, i) => {
          const status = stepStatuses[i];
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 text-sm transition-all duration-500",
                status === "pending" && "text-muted-foreground opacity-50",
                status === "active" && "text-foreground opacity-100",
                status === "complete" && "text-muted-foreground opacity-80"
              )}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {status === "complete" ? (
                  <Check className="h-4 w-4 text-green-500 animate-in zoom-in duration-300" />
                ) : status === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground/40" />
                )}
              </div>
              <span
                className={cn(
                  "transition-all duration-300",
                  status === "complete" && "line-through"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        This usually takes 10-15 seconds
      </p>
    </div>
  );
}
