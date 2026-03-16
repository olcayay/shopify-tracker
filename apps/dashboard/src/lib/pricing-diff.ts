import type { PricingPlan } from "@appranks/shared";

export function formatPlanPrice(plan: PricingPlan): string {
  if (!plan.price) return "Free";
  const currency = plan.currency_code || "$";
  const period = plan.period ? `/${plan.period}` : "";
  return `${currency}${plan.price}${period}`;
}

export function diffPricingPlans(oldPlans: PricingPlan[], newPlans: PricingPlan[]) {
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
