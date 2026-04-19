import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingCtaButton } from "@/components/pricing-cta-button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for app marketplace intelligence. Start free, upgrade as you grow.",
};

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  /** Stripe Price ID for checkout (set via NEXT_PUBLIC_STRIPE_PRICE_* env vars) */
  priceId?: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic tracking",
    features: [
      "3 tracked apps",
      "5 tracked keywords",
      "1 platform",
      "1 team member",
      "Daily data updates",
      "7-day history",
    ],
    cta: "Start free",
    ctaHref: "/register",
    priceId: undefined,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For growing app businesses",
    features: [
      "25 tracked apps",
      "50 tracked keywords",
      "3 platforms",
      "3 team members",
      "Real-time alerts",
      "90-day history",
      "CSV data export",
      "Competitor tracking",
    ],
    cta: "Start free trial",
    ctaHref: "/register",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || undefined,
    highlight: true,
  },
  {
    name: "Business",
    price: "$79",
    period: "/month",
    description: "For teams and agencies",
    features: [
      "100 tracked apps",
      "200 tracked keywords",
      "All 11 platforms",
      "10 team members",
      "Priority data updates",
      "Unlimited history",
      "CSV & API export",
      "Research projects",
      "Priority support",
    ],
    cta: "Start free trial",
    ctaHref: "/register",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS || undefined,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: [
      "Unlimited tracked apps",
      "Unlimited keywords",
      "All 11 platforms",
      "Unlimited team members",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
      "Custom data retention",
    ],
    cta: "Contact us",
    ctaHref: "mailto:hello@appranks.io",
  },
];

const COMPARISON_FEATURES = [
  { name: "Tracked apps", free: "3", pro: "25", business: "100", enterprise: "Unlimited" },
  { name: "Tracked keywords", free: "5", pro: "50", business: "200", enterprise: "Unlimited" },
  { name: "Platforms", free: "1", pro: "3", business: "11", enterprise: "11" },
  { name: "Team members", free: "1", pro: "3", business: "10", enterprise: "Unlimited" },
  { name: "Competitor tracking", free: false, pro: true, business: true, enterprise: true },
  { name: "Real-time alerts", free: false, pro: true, business: true, enterprise: true },
  { name: "CSV export", free: false, pro: true, business: true, enterprise: true },
  { name: "Research projects", free: false, pro: false, business: true, enterprise: true },
  { name: "API access", free: false, pro: false, business: true, enterprise: true },
  { name: "Priority support", free: false, pro: false, business: true, enterprise: true },
];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <Card className={plan.highlight ? "border-primary shadow-lg scale-[1.02]" : ""}>
      {plan.highlight && (
        <div className="bg-primary text-primary-foreground text-xs font-medium text-center py-1 rounded-t-lg">
          Most popular
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="pt-2">
          <span className="text-3xl font-bold">{plan.price}</span>
          {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PricingCtaButton
          planName={plan.name}
          ctaLabel={plan.cta}
          ctaHref={plan.ctaHref}
          priceId={plan.priceId}
          highlight={plan.highlight}
        />
        <ul className="space-y-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function PricingPage() {
  return (
    <div className="py-16 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold">Simple, transparent pricing</h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Start free and upgrade as your app business grows. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Compare plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 font-medium">Feature</th>
                  <th className="text-center py-3 px-4 font-medium">Free</th>
                  <th className="text-center py-3 px-4 font-medium">Pro</th>
                  <th className="text-center py-3 px-4 font-medium">Business</th>
                  <th className="text-center py-3 px-4 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((f) => (
                  <tr key={f.name} className="border-b last:border-0">
                    <td className="py-3 pr-4 text-muted-foreground">{f.name}</td>
                    {(["free", "pro", "business", "enterprise"] as const).map((tier) => (
                      <td key={tier} className="text-center py-3 px-4">
                        {typeof f[tier] === "boolean" ? (
                          f[tier] ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )
                        ) : (
                          <span>{f[tier]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium">Can I change plans later?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Yes, you can upgrade or downgrade at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Is there a free trial?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Yes, all paid plans include a 14-day free trial. No credit card required.
              </p>
            </div>
            <div>
              <h3 className="font-medium">What happens if I exceed my limits?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ll receive a notification and can upgrade to continue tracking more apps and keywords.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Can I cancel anytime?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Absolutely. You can cancel your subscription at any time with no cancellation fees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
