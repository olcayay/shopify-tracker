import {
  pgTable,
  serial,
  varchar,
  date,
  integer,
  decimal,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.js";

export const appReviewMetrics = pgTable(
  "app_review_metrics",
  {
    id: serial("id").primaryKey(),
    appSlug: varchar("app_slug", { length: 255 })
      .notNull()
      .references(() => apps.slug),
    computedAt: date("computed_at").notNull(),
    ratingCount: integer("rating_count"),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    v7d: integer("v7d"),
    v30d: integer("v30d"),
    v90d: integer("v90d"),
    accMicro: decimal("acc_micro", { precision: 8, scale: 2 }),
    accMacro: decimal("acc_macro", { precision: 8, scale: 2 }),
    momentum: varchar("momentum", { length: 20 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_app_review_metrics_unique").on(table.appSlug, table.computedAt),
    index("idx_app_review_metrics_date").on(table.computedAt),
  ]
);
