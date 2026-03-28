import type { PlatformId } from "@appranks/shared";
import type { ComponentType } from "react";

/** Props passed to every platform section component. */
export interface PlatformSectionProps {
  platform: PlatformId;
  platformData: Record<string, any>;
  snapshot: Record<string, any>;
  app: Record<string, any>;
}

/** A registerable platform-specific section. */
export interface PlatformSection {
  /** Unique section ID */
  id: string;
  /** Section component to render */
  component: ComponentType<PlatformSectionProps>;
  /** Optional: only render if this returns true */
  shouldRender?: (props: PlatformSectionProps) => boolean;
}

// Import platform section registries
import { atlassianSections } from "./atlassian-sections.js";
import { salesforceSections } from "./salesforce-sections.js";
import { googleWorkspaceSections } from "./google-workspace-sections.js";
import { wordpressSections } from "./wordpress-sections.js";

/** Registry of platform-specific sections. */
const PLATFORM_SECTIONS: Partial<Record<PlatformId, PlatformSection[]>> = {
  atlassian: atlassianSections,
  salesforce: salesforceSections,
  google_workspace: googleWorkspaceSections,
  wordpress: wordpressSections,
};

/** Get platform-specific section components for a given platform. */
export function getPlatformSections(platform: PlatformId): PlatformSection[] {
  return PLATFORM_SECTIONS[platform] ?? [];
}
