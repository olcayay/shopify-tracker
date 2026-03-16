import { formatDateOnly } from "@/lib/format-date";
import { getAppChanges } from "@/lib/api";
import type { PlatformId, PricingPlan } from "@appranks/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatPlanPrice(plan: PricingPlan): string {
  if (!plan.price) return "Free";
  const currency = plan.currency_code || "$";
  const period = plan.period ? `/${plan.period}` : "";
  return `${currency}${plan.price}${period}`;
}

function diffPricingPlans(oldPlans: PricingPlan[], newPlans: PricingPlan[]) {
  const added: PricingPlan[] = [];
  const removed: PricingPlan[] = [];
  const modified: { name: string; changes: string[] }[] = [];

  const oldByName = new Map(oldPlans.map((p) => [p.name, p]));
  const newByName = new Map(newPlans.map((p) => [p.name, p]));

  for (const [name, plan] of newByName) {
    if (!oldByName.has(name)) {
      added.push(plan);
    }
  }
  for (const [name, plan] of oldByName) {
    if (!newByName.has(name)) {
      removed.push(plan);
    }
  }

  for (const [name, newPlan] of newByName) {
    const oldPlan = oldByName.get(name);
    if (!oldPlan) continue;
    const diffs: string[] = [];

    if (oldPlan.price !== newPlan.price || oldPlan.period !== newPlan.period) {
      diffs.push(`Price: ${formatPlanPrice(oldPlan)} \u2192 ${formatPlanPrice(newPlan)}`);
    }
    if (oldPlan.yearly_price !== newPlan.yearly_price) {
      diffs.push(`Yearly price: ${oldPlan.yearly_price || "\u2014"} \u2192 ${newPlan.yearly_price || "\u2014"}`);
    }
    if (oldPlan.trial_text !== newPlan.trial_text) {
      diffs.push(`Trial: ${oldPlan.trial_text || "none"} \u2192 ${newPlan.trial_text || "none"}`);
    }

    const oldFeats = new Set(oldPlan.features || []);
    const newFeats = new Set(newPlan.features || []);
    const addedFeats = [...newFeats].filter((f) => !oldFeats.has(f));
    const removedFeats = [...oldFeats].filter((f) => !newFeats.has(f));
    if (addedFeats.length > 0) diffs.push(`Added features: ${addedFeats.join(", ")}`);
    if (removedFeats.length > 0) diffs.push(`Removed features: ${removedFeats.join(", ")}`);

    if (diffs.length > 0) {
      modified.push({ name, changes: diffs });
    }
  }

  return { added, removed, modified };
}

export default async function ChangesPage({
  params,
}: {
  params: Promise<{ platform: string; slug: string }>;
}) {
  const { platform, slug } = await params;

  let changes: any[] = [];
  try {
    changes = await getAppChanges(slug, 50, platform as PlatformId);
  } catch {
    changes = [];
  }

  if (changes.length === 0) {
    return (
      <p className="text-muted-foreground">No listing changes detected yet.</p>
    );
  }

  const isCanva = platform === "canva";
  const fieldLabels: Record<string, string> = {
    name: "App Name",
    appIntroduction: isCanva ? "Short Description" : "App Introduction",
    appDetails: isCanva ? "Description" : "App Details",
    features: "Features",
    pricingPlans: "Pricing Plans",
    seoTitle: "SEO Title",
    seoMetaDescription: "SEO Meta Description",
    appCardSubtitle: isCanva ? "Tagline" : "App Card Subtitle",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listing Changes ({changes.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {changes.map((change: any) => {
            const isFeatures = change.field === "features";
            const isPricing = change.field === "pricingPlans";
            let addedFeatures: string[] = [];
            let removedFeatures: string[] = [];
            let pricingDiff: ReturnType<typeof diffPricingPlans> | null = null;

            if (isFeatures) {
              try {
                const oldArr: string[] = JSON.parse(change.oldValue || "[]");
                const newArr: string[] = JSON.parse(change.newValue || "[]");
                addedFeatures = newArr.filter((f) => !oldArr.includes(f));
                removedFeatures = oldArr.filter((f) => !newArr.includes(f));
              } catch { /* ignore parse errors */ }
            }

            if (isPricing) {
              try {
                const oldPlans: PricingPlan[] = JSON.parse(change.oldValue || "[]");
                const newPlans: PricingPlan[] = JSON.parse(change.newValue || "[]");
                pricingDiff = diffPricingPlans(oldPlans, newPlans);
              } catch { /* ignore parse errors */ }
            }

            return (
              <div
                key={change.id}
                className="border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {fieldLabels[change.field] || change.field}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateOnly(change.detectedAt)}
                  </span>
                </div>
                {isPricing && pricingDiff ? (
                  <div className="space-y-2 text-sm">
                    {pricingDiff.removed.map((plan, i) => (
                      <div key={`rp-${i}`} className="text-red-500">
                        <p className="font-medium line-through">- {plan.name} ({formatPlanPrice(plan)})</p>
                        {(plan.features || []).length > 0 && (
                          <ul className="ml-4 text-xs text-red-400 list-disc">
                            {plan.features.map((f, j) => <li key={j}>{f}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                    {pricingDiff.added.map((plan, i) => (
                      <div key={`ap-${i}`} className="text-green-600">
                        <p className="font-medium">+ {plan.name} ({formatPlanPrice(plan)})</p>
                        {(plan.features || []).length > 0 && (
                          <ul className="ml-4 text-xs text-green-500 list-disc">
                            {plan.features.map((f, j) => <li key={j}>{f}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                    {pricingDiff.modified.map((mod, i) => (
                      <div key={`mp-${i}`}>
                        <p className="font-medium text-amber-600">{mod.name}</p>
                        <ul className="ml-4 text-xs space-y-0.5">
                          {mod.changes.map((c, j) => (
                            <li key={j} className="text-muted-foreground">{c}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {pricingDiff.added.length === 0 && pricingDiff.removed.length === 0 && pricingDiff.modified.length === 0 && (
                      <p className="text-muted-foreground italic">Plan details changed</p>
                    )}
                  </div>
                ) : isFeatures ? (
                  <div className="space-y-1 text-sm">
                    {removedFeatures.map((f, i) => (
                      <p key={`r-${i}`} className="text-red-500 line-through">
                        - {f}
                      </p>
                    ))}
                    {addedFeatures.map((f, i) => (
                      <p key={`a-${i}`} className="text-green-600">
                        + {f}
                      </p>
                    ))}
                    {addedFeatures.length === 0 && removedFeatures.length === 0 && (
                      <p className="text-muted-foreground italic">Order changed</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <p className="text-red-500/80 line-clamp-3">
                        {change.oldValue || <span className="italic">(empty)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">After</p>
                      <p className="text-green-600/80 line-clamp-3">
                        {change.newValue || <span className="italic">(empty)</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
