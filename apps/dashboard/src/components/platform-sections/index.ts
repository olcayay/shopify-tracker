import type { PlatformId, PlatformData } from "@appranks/shared";
import type { ComponentType } from "react";

/** Props passed to every platform section component, typed per-platform. */
export interface PlatformSectionProps<P extends PlatformId = PlatformId> {
  platform: P;
  platformData: PlatformData<P>;
  snapshot: Record<string, any>;
  app: Record<string, any>;
}

/** A registerable platform-specific section. */
export interface PlatformSection {
  /** Unique section ID */
  id: string;
  /** Section component to render */
  component: ComponentType<PlatformSectionProps<any>>;
  /** Optional: only render if this returns true */
  shouldRender?: (props: PlatformSectionProps<any>) => boolean;
  /** Where to render in the details page layout. Defaults to "top". */
  position?: "top" | "bottom";
}

// Import platform section registries
import { atlassianSections } from "./atlassian-sections";
import { salesforceSections } from "./salesforce-sections";
import { googleWorkspaceSections } from "./google-workspace-sections";
import { wordpressSections } from "./wordpress-sections";
import { shopifySections } from "./shopify-sections";
import { canvaSections } from "./canva-sections";
import { zoomSections } from "./zoom-sections";
import { zohoSections } from "./zoho-sections";
import { wixSections } from "./wix-sections";
import { hubspotSections } from "./hubspot-sections";
import { zendeskSections } from "./zendesk-sections";
import { woocommerceSections } from "./woocommerce-sections";

/** Registry of platform-specific sections. */
const PLATFORM_SECTIONS: Partial<Record<PlatformId, PlatformSection[]>> = {
  atlassian: atlassianSections,
  salesforce: salesforceSections,
  google_workspace: googleWorkspaceSections,
  wordpress: wordpressSections,
  shopify: shopifySections,
  canva: canvaSections,
  zoom: zoomSections,
  zoho: zohoSections,
  wix: wixSections,
  hubspot: hubspotSections,
  zendesk: zendeskSections,
  woocommerce: woocommerceSections,
};

/** Get platform-specific section components for a given platform. */
export function getPlatformSections(platform: PlatformId): PlatformSection[] {
  return PLATFORM_SECTIONS[platform] ?? [];
}
