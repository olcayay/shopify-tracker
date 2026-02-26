import {
  pgTable,
  serial,
  varchar,
  date,
  decimal,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.js";

export const appSimilarityScores = pgTable(
  "app_similarity_scores",
  {
    id: serial("id").primaryKey(),
    appSlugA: varchar("app_slug_a", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    appSlugB: varchar("app_slug_b", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    overallScore: decimal("overall_score", { precision: 5, scale: 4 }).notNull(),
    categoryScore: decimal("category_score", { precision: 5, scale: 4 }).notNull(),
    featureScore: decimal("feature_score", { precision: 5, scale: 4 }).notNull(),
    keywordScore: decimal("keyword_score", { precision: 5, scale: 4 }).notNull(),
    textScore: decimal("text_score", { precision: 5, scale: 4 }).notNull(),
    computedAt: date("computed_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_app_similarity_scores_unique").on(table.appSlugA, table.appSlugB),
    index("idx_app_similarity_scores_a").on(table.appSlugA),
    index("idx_app_similarity_scores_b").on(table.appSlugB),
  ]
);
