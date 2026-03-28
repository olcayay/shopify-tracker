import { z } from "zod";

const TAG_COLORS = [
  "red",
  "orange",
  "amber",
  "emerald",
  "cyan",
  "blue",
  "violet",
  "pink",
  "slate",
  "rose",
] as const;

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  company: z.string().max(200).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["editor", "viewer"]).default("viewer"),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["editor", "viewer"]).default("viewer"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["editor", "viewer"]),
});

export const addTrackedAppSchema = z.object({
  slug: z.string().min(1, "App slug is required").max(200),
});

export const addTrackedKeywordSchema = z.object({
  keyword: z.string().min(1, "Keyword is required").max(200),
  trackedAppSlug: z.string().min(1, "trackedAppSlug is required").max(200),
});

export const addCompetitorSchema = z.object({
  slug: z.string().min(1, "Competitor slug is required").max(200),
  trackedAppSlug: z.string().min(1, "trackedAppSlug is required").max(200),
});

export const reorderCompetitorsSchema = z.object({
  slugs: z.array(z.string().min(1)).min(1),
});

export const addKeywordToAppSchema = z.object({
  keyword: z.string().min(1, "Keyword is required").max(200),
});

export const addStarredCategorySchema = z.object({
  slug: z.string().min(1, "Category slug is required").max(200),
});

export const addStarredFeatureSchema = z.object({
  handle: z.string().min(1, "Feature handle is required").max(200),
  title: z.string().min(1, "Feature title is required").max(200),
});

export const createKeywordTagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50),
  color: z.enum(TAG_COLORS, { errorMap: () => ({ message: "Invalid color" }) }),
});

export const updateKeywordTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .enum(TAG_COLORS, { errorMap: () => ({ message: "Invalid color" }) })
    .optional(),
});

export const platformRequestSchema = z.object({
  platformName: z.string().min(1, "Platform name is required").max(200),
  marketplaceUrl: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
