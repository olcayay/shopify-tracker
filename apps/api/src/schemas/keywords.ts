import { z } from "zod";

export const ensureKeywordSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword is required").max(200),
});

export const opportunitySchema = z.object({
  slugs: z.array(z.string().min(1)).min(1).max(100, "Maximum 100 slugs"),
});
