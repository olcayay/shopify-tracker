"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// ─── Competitor Pricing Reference ────────────────────────────

export function CompetitorPricingReference({
  competitors,
}: {
  competitors: { slug: string; name: string; pricingPlans: any[] }[];
}) {
  const [expanded, setExpanded] = useState(false);

  const compsWithPlans = competitors.filter((c) => (c.pricingPlans || []).length > 0);
  if (compsWithPlans.length === 0) return null;

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Competitor Pricing
        <span className="text-xs text-muted-foreground">({compsWithPlans.length} competitors)</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {compsWithPlans.map((comp) => (
            <div key={comp.slug}>
              <p className="text-xs font-medium mb-1">{comp.name}</p>
              <div className="flex gap-2 flex-wrap">
                {(comp.pricingPlans || []).map((plan: any, i: number) => (
                  <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-muted-foreground ml-1">
                      {plan.price ? `$${plan.price}/${plan.period || "mo"}` : "Free"}
                    </span>
                    {plan.features?.length > 0 && (
                      <span className="text-muted-foreground ml-1">({plan.features.length} features)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
