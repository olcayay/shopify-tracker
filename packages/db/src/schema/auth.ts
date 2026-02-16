import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const accountRoleEnum = pgEnum("account_role", [
  "owner",
  "editor",
  "viewer",
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  maxTrackedApps: integer("max_tracked_apps").notNull().default(10),
  maxTrackedKeywords: integer("max_tracked_keywords").notNull().default(10),
  maxCompetitorApps: integer("max_competitor_apps").notNull().default(5),
  maxTrackedFeatures: integer("max_tracked_features").notNull().default(10),
  isSuspended: boolean("is_suspended").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    role: accountRoleEnum("role").notNull().default("viewer"),
    isSystemAdmin: boolean("is_system_admin").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_users_account").on(table.accountId),
    index("idx_users_email").on(table.email),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    email: varchar("email", { length: 255 }).notNull(),
    role: accountRoleEnum("role").notNull().default("viewer"),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_invitations_token").on(table.token),
    index("idx_invitations_email").on(table.email),
  ]
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_refresh_tokens_user").on(table.userId)]
);
