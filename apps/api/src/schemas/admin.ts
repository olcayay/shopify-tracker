import { z } from "zod";

export const addTrackedAppSchema = z.object({
  slug: z.string().trim().min(1, "App slug is required").max(200),
});

export const addTrackedKeywordSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword is required").max(200),
});

export const triggerScraperSchema = z.object({
  type: z.enum(["category", "app_details", "keyword_search", "reviews"], {
    errorMap: () => ({
      message: "type must be one of: category, app_details, keyword_search, reviews",
    }),
  }),
  platform: z.string().min(1).optional(),
});
