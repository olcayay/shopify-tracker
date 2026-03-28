import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
});

export const addKeywordSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword is required").max(200),
});

export const addCompetitorSchema = z.object({
  slug: z.string().trim().min(1, "Competitor slug is required").max(200),
});

export const createVirtualAppSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    icon: z.string().max(10).optional(),
    color: z.string().max(20).optional(),
    iconUrl: z.string().max(500).optional(),
    appCardSubtitle: z.string().max(500).optional(),
    appIntroduction: z.string().max(10000).optional(),
    appDetails: z.string().max(50000).optional(),
    seoTitle: z.string().max(200).optional(),
    seoMetaDescription: z.string().max(500).optional(),
    features: z.array(z.string().max(500)).optional(),
    integrations: z.array(z.string().max(500)).optional(),
    languages: z.array(z.string().max(100)).optional(),
    categories: z.array(z.record(z.string(), z.unknown())).optional(),
    pricingPlans: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const updateVirtualAppSchema = createVirtualAppSchema;

export const addCategoryFeatureSchema = z.object({
  categoryTitle: z.string().min(1).max(200),
  subcategoryTitle: z.string().min(1).max(200),
  featureTitle: z.string().min(1).max(200),
  featureHandle: z.string().min(1).max(200),
  featureUrl: z.string().max(500).optional(),
});

export const removeCategoryFeatureSchema = z.object({
  categoryTitle: z.string().min(1).max(200),
  subcategoryTitle: z.string().min(1).max(200),
  featureHandle: z.string().min(1).max(200),
});

export const addFeatureSchema = z.object({
  feature: z.string().min(1, "Feature is required").max(500),
});

export const addIntegrationSchema = z.object({
  integration: z.string().min(1, "Integration is required").max(500),
});
