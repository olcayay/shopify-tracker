import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, accounts } from "./auth.js";

// Admin-managed configuration per email type
export const emailTypeConfigs = pgTable(
  "email_type_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailType: varchar("email_type", { length: 100 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    frequencyLimitHours: integer("frequency_limit_hours"),
    config: jsonb("config"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_email_type_configs_unique").on(table.emailType),
  ]
);

// Per-account overrides for email type settings
export const emailTypeAccountOverrides = pgTable(
  "email_type_account_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    emailType: varchar("email_type", { length: 100 }).notNull(),
    enabled: boolean("enabled"),
    config: jsonb("config"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_email_type_account_overrides_unique").on(table.accountId, table.emailType),
  ]
);

// Complete log of every email sent
export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailType: varchar("email_type", { length: 100 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    recipientEmail: varchar("recipient_email", { length: 500 }).notNull(),
    recipientName: varchar("recipient_name", { length: 500 }),
    subject: varchar("subject", { length: 1000 }).notNull(),
    htmlBody: text("html_body"),
    dataSnapshot: jsonb("data_snapshot"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    sentAt: timestamp("sent_at"),
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),
    bouncedAt: timestamp("bounced_at"),
    errorMessage: text("error_message"),
    campaignId: uuid("campaign_id"),
    messageId: varchar("message_id", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_email_logs_type").on(table.emailType),
    index("idx_email_logs_user").on(table.userId),
    index("idx_email_logs_account").on(table.accountId),
    index("idx_email_logs_status").on(table.status),
    index("idx_email_logs_created").on(table.createdAt),
  ]
);

// Cold email campaign management
export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    totalProspects: integer("total_prospects").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    openCount: integer("open_count").notNull().default(0),
    clickCount: integer("click_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    config: jsonb("config"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

// Non-user contacts for cold outreach
export const emailProspects = pgTable(
  "email_prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => emailCampaigns.id, { onDelete: "set null" }),
    email: varchar("email", { length: 500 }).notNull(),
    name: varchar("name", { length: 500 }),
    appSlug: varchar("app_slug", { length: 500 }),
    platform: varchar("platform", { length: 50 }),
    status: varchar("status", { length: 50 }).notNull().default("new"),
    lastContactedAt: timestamp("last_contacted_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_email_prospects_status").on(table.status),
    index("idx_email_prospects_campaign").on(table.campaignId),
    index("idx_email_prospects_email").on(table.email),
  ]
);

// Per-user, per-email-type opt-in/out preferences
export const userEmailPreferences = pgTable(
  "user_email_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailType: varchar("email_type", { length: 100 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_email_prefs_unique").on(table.userId, table.emailType),
  ]
);

// Email suppression list — addresses that should not receive email
export const emailSuppressionList = pgTable(
  "email_suppression_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 500 }).notNull(),
    reason: varchar("reason", { length: 50 }).notNull(), // hard_bounce, soft_bounce, complaint, manual
    source: varchar("source", { length: 50 }).notNull(), // webhook, automatic, admin
    bounceCount: integer("bounce_count").notNull().default(1),
    lastBounceAt: timestamp("last_bounce_at").notNull().defaultNow(),
    diagnosticCode: text("diagnostic_code"),
    removedAt: timestamp("removed_at"), // null = active suppression
    removedBy: varchar("removed_by", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_email_suppression_email").on(table.email),
    index("idx_email_suppression_reason").on(table.reason),
  ]
);

// Daily email health metrics for bounce rate monitoring
export const emailHealthMetrics = pgTable(
  "email_health_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: timestamp("date").notNull(),
    sent: integer("sent").notNull().default(0),
    delivered: integer("delivered").notNull().default(0),
    bounced: integer("bounced").notNull().default(0),
    complained: integer("complained").notNull().default(0),
    bounceRate: varchar("bounce_rate", { length: 10 }), // e.g. "2.5"
    complaintRate: varchar("complaint_rate", { length: 10 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_email_health_metrics_date").on(table.date),
  ]
);

// One-click unsubscribe tokens
export const emailUnsubscribeTokens = pgTable(
  "email_unsubscribe_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: varchar("token", { length: 255 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailType: varchar("email_type", { length: 100 }),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_email_unsubscribe_token").on(table.token),
  ]
);
