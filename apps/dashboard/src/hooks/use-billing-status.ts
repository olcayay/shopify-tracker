"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export interface BillingStatus {
  status: string | null;
  graceDaysRemaining: number | null;
  overLimit: { any: boolean; apps?: boolean; keywords?: boolean; users?: boolean } | null;
  usage: { trackedApps: number; trackedKeywords: number; users: number } | null;
  limits: { maxTrackedApps: number; maxTrackedKeywords: number; maxUsers: number } | null;
}

const cache: { data: BillingStatus | null; promise: Promise<BillingStatus> | null } = {
  data: null,
  promise: null,
};

export function useBillingStatus(): BillingStatus {
  const { fetchWithAuth, user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus>(
    cache.data ?? { status: null, graceDaysRemaining: null, overLimit: null, usage: null, limits: null }
  );

  useEffect(() => {
    if (!user) return;

    // Return cached data if available
    if (cache.data) {
      setBilling(cache.data);
      return;
    }

    // Deduplicate: reuse in-flight promise
    if (!cache.promise) {
      cache.promise = fetchWithAuth("/api/billing/status")
        .then(async (res) => {
          if (!res.ok) throw new Error("billing fetch failed");
          const data = await res.json();
          const result: BillingStatus = {
            status: data.status,
            graceDaysRemaining: data.graceDaysRemaining ?? null,
            overLimit: data.overLimit ?? null,
            usage: data.usage ?? null,
            limits: data.limits ?? null,
          };
          cache.data = result;
          return result;
        })
        .catch(() => {
          return { status: null, graceDaysRemaining: null, overLimit: null, usage: null, limits: null };
        })
        .finally(() => {
          cache.promise = null;
        });
    }

    cache.promise.then((data) => setBilling(data));
  }, [fetchWithAuth, user]);

  return billing;
}

/** Reset cache — useful for testing or after billing changes */
export function resetBillingCache() {
  cache.data = null;
  cache.promise = null;
}
