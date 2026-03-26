import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const smokeTestResults = pgTable(
  "smoke_test_results",
  {
    id: serial("id").primaryKey(),
    platform: varchar("platform", { length: 50 }).notNull(),
    checkName: varchar("check_name", { length: 50 }).notNull(),
    status: varchar("status", { length: 10 }).notNull(),
    durationMs: integer("duration_ms"),
    error: text("error"),
    output: text("output"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_smoke_test_results_platform_check_created").on(
      table.platform,
      table.checkName,
      table.createdAt,
    ),
  ],
);
