import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";
import { users } from "./auth.js";

export const aiLogs = pgTable(
  "ai_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    platform: varchar("platform", { length: 20 }).notNull(),
    productType: varchar("product_type", { length: 30 }).notNull(),
    productId: uuid("product_id"),
    model: varchar("model", { length: 50 }).notNull(),
    systemPrompt: text("system_prompt").notNull(),
    userPrompt: text("user_prompt").notNull(),
    responseContent: text("response_content"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    durationMs: integer("duration_ms").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    errorMessage: text("error_message"),
    tags: jsonb("tags").notNull().default([]),
    notes: text("notes"),
    triggerType: varchar("trigger_type", { length: 20 }).notNull().default("manual"),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_ai_logs_account").on(table.accountId),
    index("idx_ai_logs_user").on(table.userId),
    index("idx_ai_logs_created").on(table.createdAt),
    index("idx_ai_logs_product_type").on(table.productType),
  ]
);
