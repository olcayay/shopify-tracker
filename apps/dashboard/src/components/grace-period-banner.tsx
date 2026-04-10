"use client";

import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/use-billing-status";

export function GracePeriodBanner() {
  const { status, graceDaysRemaining: graceDays } = useBillingStatus();

  if (status !== "past_due" || graceDays === null) return null;

  const isUrgent = graceDays <= 2;

  return (
    <div className={`px-4 py-2.5 text-sm flex items-center justify-between ${
      isUrgent
        ? "bg-red-600 text-white"
        : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800"
    }`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {graceDays > 0
            ? `Payment failed — ${graceDays} day${graceDays !== 1 ? "s" : ""} remaining to update your payment method.`
            : "Payment overdue — your account access may be restricted. Please update your payment method."}
        </span>
      </div>
      <Button
        size="sm"
        variant={isUrgent ? "secondary" : "outline"}
        asChild
      >
        <Link href="/settings">
          <CreditCard className="h-3 w-3 mr-1" />
          Update Payment
        </Link>
      </Button>
    </div>
  );
}
