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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";
import { apps } from "./apps.js";

// AI keyword suggestion cache (PLA-451)
export const aiKeywordSuggestions = pgTable(
  "ai_keyword_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 20 }).notNull(),
    // AI analysis
    appSummary: text("app_summary"),
    primaryCategory: varchar("primary_category", { length: 200 }),
    targetAudience: text("target_audience"),
    // Results (JSONB)
    keywords: jsonb("keywords"), // AIKeywordSuggestion[]
    ngramKeywords: jsonb("ngram_keywords"), // NgramKeyword[]
    mergedKeywords: jsonb("merged_keywords"), // MergedKeyword[]
    // Metadata
    model: varchar("model", { length: 50 }),
    aiLogId: uuid("ai_log_id"),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    durationMs: integer("duration_ms"),
    // Lifecycle
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_ai_kw_sugg_account_app").on(table.accountId, table.appId),
    index("idx_ai_kw_sugg_expires").on(table.expiresAt),
    index("idx_ai_kw_sugg_status").on(table.status),
  ]
);

// AI competitor suggestion cache (PLA-451)
export const aiCompetitorSuggestions = pgTable(
  "ai_competitor_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 20 }).notNull(),
    // AI analysis
    appSummary: text("app_summary"),
    marketContext: text("market_context"),
    // Results (JSONB)
    competitors: jsonb("competitors"), // AICompetitorScore[]
    jaccardCompetitors: jsonb("jaccard_competitors"), // JaccardScore[]
    mergedCompetitors: jsonb("merged_competitors"), // MergedCompetitor[]
    // Metadata
    model: varchar("model", { length: 50 }),
    aiLogId: uuid("ai_log_id"),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    durationMs: integer("duration_ms"),
    // Lifecycle
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_ai_comp_sugg_account_app").on(table.accountId, table.appId),
    index("idx_ai_comp_sugg_expires").on(table.expiresAt),
    index("idx_ai_comp_sugg_status").on(table.status),
  ]
);
