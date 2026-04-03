"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function OverLimitBanner() {
  const { fetchWithAuth, user } = useAuth();
  const [overLimit, setOverLimit] = useState(false);
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchWithAuth("/api/billing/status")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data.overLimit?.any) {
          setOverLimit(true);
          const parts: string[] = [];
          if (data.overLimit.apps) parts.push(`${data.usage.trackedApps}/${data.limits.maxTrackedApps} apps`);
          if (data.overLimit.keywords) parts.push(`${data.usage.trackedKeywords}/${data.limits.maxTrackedKeywords} keywords`);
          if (data.overLimit.users) parts.push(`${data.usage.users}/${data.limits.maxUsers} users`);
          setDetails(parts.join(", "));
        }
      })
      .catch(() => {});
  }, [fetchWithAuth, user]);

  if (!overLimit) return null;

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
