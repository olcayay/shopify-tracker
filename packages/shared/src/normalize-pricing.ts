/**
 * Canonical pricing model labels for cross-platform consistency.
 * Each platform parser maps its raw pricing strings to one of these values.
 */
export const PRICING_MODELS = {
  FREE: "Free",
  FREEMIUM: "Freemium",
  FREE_TRIAL: "Free trial",
  FREE_TO_INSTALL: "Free to install",
  PAID: "Paid",
} as const;

export type PricingModel = (typeof PRICING_MODELS)[keyof typeof PRICING_MODELS] | null;

/** All known raw pricing strings mapped to canonical values */
const PRICING_MAP: Record<string, PricingModel> = {
  // Free
  free: "Free",
  "free!": "Free",

  // Freemium
  freemium: "Freemium",
  "free plan available": "Freemium",
  "free_plan_available": "Freemium",
  "free with paid features": "Freemium",

  // Free trial
  "free trial": "Free trial",
  "free trial available": "Free trial",
  "free_trial": "Free trial",

  // Free to install (Shopify-specific: free install, usage-based charges)
  "free to install": "Free to install",

  // Paid
  paid: "Paid",
  monthly: "Paid",
  annual: "Paid",
  annually: "Paid",
};

/**
 * Normalize a raw pricing string from any platform into a canonical PricingModel.
 *
 * Examples:
 *   "Free"                → "Free"
 *   "FREE"                → "Free"
 *   "Free plan available" → "Freemium"
 *   "FREE_PLAN_AVAILABLE" → "Freemium"
 *   "From $9.99/mo"       → "Paid"
 *   null                  → null
 *   ""                    → null
 */
export function normalizePricingModel(raw: string | null | undefined): PricingModel {
  if (!raw || raw.trim() === "") return null;

  const normalized = raw.trim().toLowerCase();

  // Direct match
  const direct = PRICING_MAP[normalized];
  if (direct !== undefined) return direct;

  // Pattern matching for dynamic pricing strings
  if (/^from\s+\$/.test(normalized) || /^\$\d/.test(normalized)) return "Paid";
  if (/\/mo(?:nth)?$/i.test(normalized) || /\/yr$/i.test(normalized)) return "Paid";
  if (/free\s*trial/i.test(normalized)) return "Free trial";
  if (/free\s*plan/i.test(normalized)) return "Freemium";
  if (/^free$/i.test(normalized)) return "Free";

  // Unknown — return null
  return null;
}
