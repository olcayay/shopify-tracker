"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CreditCard, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BillingStatus {
  status: string;
  plan: string | null;
  periodEnd: string | null;
}

export function BillingCard() {
  const { fetchWithAuth, user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    fetchWithAuth("/api/billing/status")
      .then(async (res) => {
        if (res.ok) setBilling(await res.json());
      })
      .catch(() => {});
  }, [fetchWithAuth]);

  const isOwner = user?.role === "owner";
  const isFree = !billing || billing.status === "free";

  const handleManageBilling = async () => {
    const res = await fetchWithAuth("/api/billing/portal");
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Billing
        </CardTitle>
        <CardDescription>
          {isFree ? "You're on the free plan" : `Plan: ${billing?.plan || billing?.status}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className={`font-medium ${
            billing?.status === "active" ? "text-green-600 dark:text-green-400" :
            billing?.status === "past_due" ? "text-amber-600 dark:text-amber-400" :
            "text-muted-foreground"
          }`}>
            {billing?.status === "active" ? "Active" :
             billing?.status === "past_due" ? "Past Due" :
             billing?.status === "cancelled" ? "Cancelled" : "Free"}
          </span>
        </div>

        {billing?.periodEnd && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current period ends</span>
            <span>{new Date(billing.periodEnd).toLocaleDateString()}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {isFree ? (
            <Button size="sm" asChild>
              <Link href="/pricing">
                Upgrade
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          ) : isOwner ? (
            <Button size="sm" variant="outline" onClick={handleManageBilling}>
              Manage Billing
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
