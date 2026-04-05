import type { PlatformId } from "../../constants/platforms.js";

export type { ShopifyPlatformData } from "./shopify.js";
export type { SalesforcePlatformData } from "./salesforce.js";
export type { CanvaPlatformData } from "./canva.js";
export type { WixPlatformData } from "./wix.js";
export type { WordPressPlatformData } from "./wordpress.js";
export type { GoogleWorkspacePlatformData } from "./google-workspace.js";
export type { AtlassianPlatformData } from "./atlassian.js";
export type { ZoomPlatformData } from "./zoom.js";
export type { ZohoPlatformData } from "./zoho.js";
export type { ZendeskPlatformData } from "./zendesk.js";
export type { HubSpotPlatformData } from "./hubspot.js";
export type { WooCommercePlatformData } from "./woocommerce.js";

import type { ShopifyPlatformData } from "./shopify.js";
import type { SalesforcePlatformData } from "./salesforce.js";
import type { CanvaPlatformData } from "./canva.js";
import type { WixPlatformData } from "./wix.js";
import type { WordPressPlatformData } from "./wordpress.js";
import type { GoogleWorkspacePlatformData } from "./google-workspace.js";
import type { AtlassianPlatformData } from "./atlassian.js";
import type { ZoomPlatformData } from "./zoom.js";
import type { ZohoPlatformData } from "./zoho.js";
import type { ZendeskPlatformData } from "./zendesk.js";
import type { HubSpotPlatformData } from "./hubspot.js";
import type { WooCommercePlatformData } from "./woocommerce.js";

/** Maps platform IDs to their typed platformData interfaces. */
export interface PlatformDataMap {
  shopify: ShopifyPlatformData;
  salesforce: SalesforcePlatformData;
  canva: CanvaPlatformData;
  wix: WixPlatformData;
  wordpress: WordPressPlatformData;
  google_workspace: GoogleWorkspacePlatformData;
  atlassian: AtlassianPlatformData;
  zoom: ZoomPlatformData;
  zoho: ZohoPlatformData;
  zendesk: ZendeskPlatformData;
  hubspot: HubSpotPlatformData;
  woocommerce: WooCommercePlatformData;
}

/** Get the typed platformData interface for a specific platform. */
export type PlatformData<P extends PlatformId> = P extends keyof PlatformDataMap
  ? PlatformDataMap[P]
  : Record<string, unknown>;

/** Type-narrow raw platformData to the correct interface based on platform. */
export function getPlatformData<P extends PlatformId>(
  platform: P,
  raw: unknown
): PlatformData<P> {
  return (raw ?? {}) as PlatformData<P>;
}

/** Union of all possible platform data types. */
export type AnyPlatformData = PlatformDataMap[keyof PlatformDataMap];
