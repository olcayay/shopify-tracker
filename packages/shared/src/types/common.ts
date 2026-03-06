import type { PlatformId } from "../constants/platforms.js";

/** Cross-platform app reference (minimal fields used in listings/tables) */
export interface CommonApp {
  id: number;
  platform: PlatformId;
  slug: string;
  name: string;
  iconUrl: string | null;
  averageRating: number | null;
  ratingCount: number | null;
  pricingHint: string | null;
  badges: string[];
}

/** Cross-platform search result */
export interface CommonSearchResult {
  position: number;
  appSlug: string;
  appName: string;
  shortDescription: string;
  averageRating: number | null;
  ratingCount: number | null;
  logoUrl: string | null;
  pricingHint: string | null;
  badges: string[];
  isSponsored: boolean;
}

/** Cross-platform category */
export interface CommonCategory {
  id: number;
  platform: PlatformId;
  slug: string;
  title: string;
}
