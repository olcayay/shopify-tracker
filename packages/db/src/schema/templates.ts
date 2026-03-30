import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";

// Editable notification templates (PLA-444)
export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationType: varchar("notification_type", { length: 100 }).notNull(),
    titleTemplate: text("title_template").notNull(),
    bodyTemplate: text("body_template").notNull(),
    isCustomized: boolean("is_customized").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("idx_notification_templates_type").on(table.notificationType),
  ]
);

// Editable email templates (PLA-444)
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailType: varchar("email_type", { length: 100 }).notNull(),
    subjectTemplate: text("subject_template").notNull(),
    bodyTemplate: text("body_template").notNull(),
    isCustomized: boolean("is_customized").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("idx_email_templates_type").on(table.emailType),
  ]
);
