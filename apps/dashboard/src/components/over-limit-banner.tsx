"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/use-billing-status";

export function OverLimitBanner() {
  const { overLimit, usage, limits } = useBillingStatus();

  if (!overLimit?.any) return null;

  const parts: string[] = [];
  if (overLimit.apps && usage && limits) parts.push(`${usage.trackedApps}/${limits.maxTrackedApps} apps`);
  if (overLimit.keywords && usage && limits) parts.push(`${usage.trackedKeywords}/${limits.maxTrackedKeywords} keywords`);
  if (overLimit.users && usage && limits) parts.push(`${usage.users}/${limits.maxUsers} users`);
  const details = parts.join(", ");

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm flex items-center justify-between">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          You are over your plan limits ({details}). New additions are blocked until you upgrade or remove items.
        </span>
      </div>
      <Button size="sm" variant="outline" asChild>
        <Link href="/pricing">Upgrade Plan</Link>
      </Button>
    </div>
  );
}
