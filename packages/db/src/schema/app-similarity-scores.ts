import {
  pgTable,
  serial,
  integer,
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
    appIdA: integer("app_id_a")
      .notNull()
      .references(() => apps.id),
    appIdB: integer("app_id_b")
      .notNull()
      .references(() => apps.id),
    overallScore: decimal("overall_score", { precision: 5, scale: 4 }).notNull(),
    categoryScore: decimal("category_score", { precision: 5, scale: 4 }).notNull(),
    featureScore: decimal("feature_score", { precision: 5, scale: 4 }).notNull(),
    keywordScore: decimal("keyword_score", { precision: 5, scale: 4 }).notNull(),
    textScore: decimal("text_score", { precision: 5, scale: 4 }).notNull(),
    computedAt: date("computed_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_app_similarity_scores_unique").on(table.appIdA, table.appIdB),
    index("idx_app_similarity_scores_a").on(table.appIdA),
    index("idx_app_similarity_scores_b").on(table.appIdB),
  ]
);
