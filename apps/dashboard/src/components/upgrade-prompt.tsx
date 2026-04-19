"use client";

import Link from "@/components/ui/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  message: string;
  current?: number;
  max?: number;
}

/**
 * Shown when a user hits a plan limit.
 * Displays the limit info and links to pricing page.
 */
export function UpgradePrompt({ message, current, max }: UpgradePromptProps) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {message}
        </p>
        {current !== undefined && max !== undefined && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            Using {current} of {max}
          </p>
        )}
      </div>
      <Button size="sm" asChild>
        <Link href="/pricing">
          Upgrade
          <ArrowUpRight className="h-3 w-3 ml-1" />
        </Link>
      </Button>
    </div>
  );
}
