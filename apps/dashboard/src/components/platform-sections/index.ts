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
}

// Import platform section registries
import { atlassianSections } from "./atlassian-sections.js";
import { salesforceSections } from "./salesforce-sections.js";
import { googleWorkspaceSections } from "./google-workspace-sections.js";
import { wordpressSections } from "./wordpress-sections.js";
import { shopifySections } from "./shopify-sections.js";
import { canvaSections } from "./canva-sections.js";
import { zoomSections } from "./zoom-sections.js";
import { zohoSections } from "./zoho-sections.js";
import { wixSections } from "./wix-sections.js";
import { hubspotSections } from "./hubspot-sections.js";
import { zendeskSections } from "./zendesk-sections.js";

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
};

/** Get platform-specific section components for a given platform. */
export function getPlatformSections(platform: PlatformId): PlatformSection[] {
  return PLATFORM_SECTIONS[platform] ?? [];
}
