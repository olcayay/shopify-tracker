import { z } from "zod";

export const slugsBodySchema = z.object({
  slugs: z.array(z.string().min(1)).min(1).max(500, "Maximum 500 slugs per request"),
});
