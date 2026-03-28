import type { PlatformId } from "./platforms";

export interface PlatformFieldLabels {
  name: string;
  appIntroduction: string;
  appDetails: string;
  features: string;
  pricingPlans: string;
  seoTitle: string;
  seoMetaDescription: string;
  appCardSubtitle: string;
}

const DEFAULT_LABELS: PlatformFieldLabels = {
  name: "App Name",
  appIntroduction: "Introduction",
  appDetails: "Details",
  features: "Features",
  pricingPlans: "Pricing Plans",
  seoTitle: "SEO Title",
  seoMetaDescription: "SEO Description",
  appCardSubtitle: "Subtitle",
};

const OVERRIDES: Partial<Record<PlatformId, Partial<PlatformFieldLabels>>> = {
  canva: {
    appIntroduction: "Short Description",
    appDetails: "Description",
    appCardSubtitle: "Tagline",
  },
  wix: {
    appIntroduction: "Short Description",
    appDetails: "Description",
    appCardSubtitle: "Tagline",
  },
  wordpress: {
    appIntroduction: "Short Description",
    appDetails: "Description",
    appCardSubtitle: "Short Description",
  },
  google_workspace: {
    appIntroduction: "Short Description",
    appDetails: "Description",
    appCardSubtitle: "Short Description",
  },
  atlassian: {
    appIntroduction: "Summary",
    appDetails: "Description",
    appCardSubtitle: "Tag Line",
  },
  hubspot: {
    appIntroduction: "Short Description",
    appDetails: "Description",
    appCardSubtitle: "Short Description",
  },
};

export function getFieldLabels(platform: string): PlatformFieldLabels {
  return { ...DEFAULT_LABELS, ...OVERRIDES[platform as PlatformId] };
}
