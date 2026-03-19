import { createLogger } from "@appranks/shared";
import type { NormalizedAppDetails } from "../../platform-module.js";
import { zoomUrls } from "../urls.js";

const log = createLogger("zoom:app-parser");

/**
 * Parse a Zoom app from filter/search API result into NormalizedAppDetails.
 *
 * Since the individual app detail API (/api/v1/apps/{id}) requires auth,
 * we use the data available from filter/search endpoints.
 */
export function parseZoomApp(app: Record<string, any>): NormalizedAppDetails {
  const id = app.id || "";
  const name = app.displayName || app.name || "";
  const slug = id; // Zoom uses base64-like IDs as slugs

  const ratingStats = app.ratingStatistics || {};
  const averageRating = ratingStats.averageRating ?? null;
  const ratingCount = ratingStats.totalRatings ?? null;

  const iconUrl = app.icon ? zoomUrls.iconUrl(app.icon) : null;
  const companyName = app.companyName || null;

  const badges: string[] = [];
  if (app.fedRampAuthorized) badges.push("fedramp_authorized");
  if (app.essentialApp) badges.push("essential_app");

  const platformData: Record<string, unknown> = {
    description: app.description || null,
    companyName,
    worksWith: app.worksWith || [],
    usage: app.usage || null,
    fedRampAuthorized: app.fedRampAuthorized || false,
    essentialApp: app.essentialApp || false,
    ratingStatistics: ratingStats,
  };

  return {
    name,
    slug,
    averageRating,
    ratingCount,
    pricingHint: null, // Pricing requires auth
    iconUrl,
    developer: companyName ? { name: companyName } : null,
    badges,
    platformData,
  };
}
