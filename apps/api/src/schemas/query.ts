import { z } from "zod";

/** Standard pagination query parameters */
export const paginationQuerySchema = z.object({
  limit: z.string().optional().default("50"),
  offset: z.string().optional().default("0"),
  page: z.string().optional(),
});

/** Pagination with search */
export const searchPaginationSchema = paginationQuerySchema.extend({
  search: z.string().optional().default(""),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

/** Featured apps / time-range query */
export const timeRangeQuerySchema = paginationQuerySchema.extend({
  days: z.string().optional().default("30"),
});

/** Parse and clamp pagination values */
export function parsePaginationQuery(query: unknown, maxLimit = 200) {
  const parsed = paginationQuerySchema.safeParse(query);
  if (!parsed.success) return { limit: 50, offset: 0 };
  return {
    limit: Math.min(Math.max(parseInt(parsed.data.limit, 10) || 50, 1), maxLimit),
    offset: Math.max(parseInt(parsed.data.offset, 10) || 0, 0),
  };
}
