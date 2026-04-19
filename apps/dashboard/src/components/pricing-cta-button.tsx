"use client";

import { useState } from "react";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PricingCtaButtonProps {
  planName: string;
  ctaLabel: string;
  ctaHref: string;
  priceId?: string;
  highlight?: boolean;
}

/**
 * Smart CTA button for pricing plans.
 * - Not authenticated: links to /register
 * - Authenticated + free plan: triggers Stripe checkout if priceId provided
 * - Enterprise: links to mailto
 */
export function PricingCtaButton({ planName, ctaLabel, ctaHref, priceId, highlight }: PricingCtaButtonProps) {
  const { user, fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!priceId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ priceId }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
          return;
        }
      }
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to start checkout");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Authenticated user with a paid plan priceId → show checkout button
  if (user && priceId && planName !== "Free" && planName !== "Enterprise") {
    return (
      <Button
        className="w-full"
        variant={highlight ? "default" : "outline"}
        onClick={handleCheckout}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
        {loading ? "Redirecting..." : ctaLabel}
      </Button>
    );
  }

  // Default: link to register/contact
  return (
    <Button asChild className="w-full" variant={highlight ? "default" : "outline"}>
      <Link href={ctaHref}>{ctaLabel}</Link>
    </Button>
  );
}
