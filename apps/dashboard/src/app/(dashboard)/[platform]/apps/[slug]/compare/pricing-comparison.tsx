"use client";

import { useMemo } from "react";
import { CompareSection } from "./compare-section";
import { LinkedAppIcon } from "./app-icon";
import type { AppData } from "./compare-types";

function PlanCard({ plan }: { plan: any }) {
  const planName = plan.name || plan.plan_name;
  let priceLabel = "Free";
  if (plan.price) {
    const suffix = [plan.currency_code, plan.units, plan.period].filter(Boolean).join("/");
    priceLabel = suffix ? `$${plan.price} ${suffix}` : `$${plan.price}`;
  }
  return (
    <div className="border rounded-lg p-3">
      <div className="font-semibold">{planName}</div>
      <div className="text-lg font-bold mt-1">{priceLabel}</div>
      {plan.trial_text && (
        <p className="text-xs text-muted-foreground mt-1">
          {plan.trial_text}
        </p>
      )}
      {plan.features?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {plan.features.map((f: string, j: number) => (
            <li key={j} className="text-xs text-muted-foreground">
              • {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PricingComparison({
  id,
  sectionKey,
  collapsed,
  onToggle,
  apps,
}: {
  id?: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  apps: AppData[];
}) {
  // Split each app's plans into free + paid (sorted by price ascending)
  const appPlans = useMemo(() => {
    return apps.map((app) => {
      const plans = app.latestSnapshot?.pricingPlans || [];
      const free = plans.filter((p: any) => !p.price || Number(p.price) === 0);
      const paid = plans
        .filter((p: any) => p.price && Number(p.price) > 0)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price));
      return { free, paid };
    });
  }, [apps]);

  const hasAnyFree = appPlans.some((ap) => ap.free.length > 0);
  const maxPaid = Math.max(...appPlans.map((ap) => ap.paid.length), 0);
  const totalRows = (hasAnyFree ? 1 : 0) + maxPaid;

  if (totalRows === 0) return null;

  return (
    <CompareSection
      id={id}
      title="Pricing Plans"
      sectionKey={sectionKey}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-[160px] min-w-[160px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                Tier
              </th>
              {apps.map((app) => (
                <th key={app.slug} className="py-2 px-2 pb-6 min-w-[130px] sticky top-0 bg-card z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))]">
                  <div className="flex justify-center">
                    <LinkedAppIcon app={app} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasAnyFree && (
              <tr className="border-b align-top">
                <td className="py-2 pr-4 text-muted-foreground font-medium">
                  Free
                </td>
                {appPlans.map((ap, idx) => (
                  <td key={apps[idx].slug} className="py-2 px-2">
                    {ap.free.length > 0 ? (
                      <PlanCard plan={ap.free[0]} />
                    ) : (
                      <div className="text-muted-foreground text-center">—</div>
                    )}
                  </td>
                ))}
              </tr>
            )}
            {Array.from({ length: maxPaid }).map((_, rowIdx) => (
              <tr key={`paid-${rowIdx}`} className="border-b last:border-0 align-top">
                <td className="py-2 pr-4 text-muted-foreground font-medium">
                  {hasAnyFree ? `Paid ${rowIdx + 1}` : `Plan ${rowIdx + 1}`}
                </td>
                {appPlans.map((ap, idx) => (
                  <td key={apps[idx].slug} className="py-2 px-2">
                    {ap.paid[rowIdx] ? (
                      <PlanCard plan={ap.paid[rowIdx]} />
                    ) : (
                      <div className="text-muted-foreground text-center">—</div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompareSection>
  );
}
