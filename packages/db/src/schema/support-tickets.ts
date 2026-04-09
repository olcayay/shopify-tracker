import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { accounts, users } from "./auth.js";

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ticketNumber: integer("ticket_number").generatedAlwaysAsIdentity(),
    type: varchar("type", { length: 50 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    assignedAdminId: uuid("assigned_admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastMessageAt: timestamp("last_message_at"),
    resolvedAt: timestamp("resolved_at"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_tickets_account").on(table.accountId),
    index("idx_support_tickets_status").on(table.status),
    index("idx_support_tickets_type").on(table.type),
    index("idx_support_tickets_created").on(table.createdAt),
    index("idx_support_tickets_account_status").on(
      table.accountId,
      table.status
    ),
  ]
);

export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isInternalNote: boolean("is_internal_note").notNull().default(false),
    isSystemMessage: boolean("is_system_message").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_messages_ticket").on(table.ticketId),
    index("idx_support_messages_ticket_created").on(
      table.ticketId,
      table.createdAt
    ),
  ]
);

export const supportTicketAttachments = pgTable(
  "support_ticket_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => supportTicketMessages.id, {
      onDelete: "set null",
    }),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    storageKey: varchar("storage_key", { length: 1000 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_attachments_ticket").on(table.ticketId),
  ]
);
