import { normalizePricingModel } from "@appranks/shared";

/**
 * Render-time pricing-model formatter for the dashboard.
 *
 * Always pass API-returned pricing strings through this before display so the
 * user sees one of the 5 canonical labels (or `—`) regardless of which
 * platform / legacy row the value came from. See PLA-1109.
 */
export function displayPricingModel(raw: string | null | undefined): string {
  return normalizePricingModel(raw) ?? "\u2014";
}
