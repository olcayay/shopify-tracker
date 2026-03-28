// ─── Types ───────────────────────────────────────────────────

export interface VirtualApp {
  id: string;
  researchProjectId: string;
  name: string;
  icon: string;
  color: string;
  iconUrl: string | null;
  appCardSubtitle: string;
  appIntroduction: string;
  appDetails: string;
  seoTitle: string;
  seoMetaDescription: string;
  features: string[];
  integrations: string[];
  languages: string[];
  categories: any[];
  pricingPlans: any[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchData {
  project: { id: string; name: string };
  competitors: {
    slug: string;
    name: string;
    categories: any[];
    features: string[];
    integrations: string[];
    languages: string[];
    pricingPlans: any[];
  }[];
}

export interface PricingPlan {
  name: string;
  price: string | null;
  period: string | null;
  trial_text: string | null;
  features: string[];
}

export interface CategoryTreeNode {
  slug: string;
  title: string;
  parentSlug: string | null;
  categoryLevel: number;
  isListingPage: boolean;
  appCount: number | null;
  children: CategoryTreeNode[];
}
