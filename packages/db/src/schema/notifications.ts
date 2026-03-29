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

// Main notification store
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 100 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body"),
    url: varchar("url", { length: 1000 }),
    icon: varchar("icon", { length: 500 }),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    eventData: jsonb("event_data"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    isArchived: boolean("is_archived").notNull().default(false),
    pushSent: boolean("push_sent").notNull().default(false),
    pushSentAt: timestamp("push_sent_at"),
    pushClicked: boolean("push_clicked").notNull().default(false),
    pushClickedAt: timestamp("push_clicked_at"),
    pushDismissed: boolean("push_dismissed").notNull().default(false),
    pushError: text("push_error"),
    triggerJobId: varchar("trigger_job_id", { length: 255 }),
    batchId: varchar("batch_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_notifications_user_unread").on(table.userId, table.createdAt),
    index("idx_notifications_type").on(table.type),
    index("idx_notifications_category").on(table.category),
    index("idx_notifications_created").on(table.createdAt),
  ]
);

// Web Push subscriptions per user/device
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: varchar("user_agent", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    lastPushAt: timestamp("last_push_at"),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_push_subs_active").on(table.userId),
  ]
);

// Admin-managed global notification type settings
export const notificationTypeConfigs = pgTable(
  "notification_type_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationType: varchar("notification_type", { length: 100 }).notNull(),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    pushDefaultEnabled: boolean("push_default_enabled").notNull().default(false),
    config: jsonb("config"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_notification_type_configs_unique").on(table.notificationType),
  ]
);

// Per-user notification preference overrides
export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationType: varchar("notification_type", { length: 100 }).notNull(),
    inAppEnabled: boolean("in_app_enabled"),
    pushEnabled: boolean("push_enabled"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_notification_prefs_unique").on(table.userId, table.notificationType),
  ]
);

// Delivery log for admin dashboard
export const notificationDeliveryLog = pgTable(
  "notification_delivery_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 50 }).notNull(),
    pushSubscriptionId: uuid("push_subscription_id"),
    status: varchar("status", { length: 50 }).notNull(),
    statusCode: integer("status_code"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
    interactedAt: timestamp("interacted_at"),
  },
  (table) => [
    index("idx_delivery_log_notification").on(table.notificationId),
    index("idx_delivery_log_sent").on(table.sentAt),
  ]
);
