import { pgTable, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { categories } from "./categories.js";

export const categoryParents = pgTable(
  "category_parents",
  {
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    parentCategoryId: integer("parent_category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.parentCategoryId] }),
    index("idx_category_parents_parent").on(t.parentCategoryId),
  ]
);
