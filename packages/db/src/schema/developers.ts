import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const globalDevelopers = pgTable(
  "global_developers",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: text("name").notNull(),
    website: text("website"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_global_developers_slug").on(table.slug),
  ]
);

export const platformDevelopers = pgTable(
  "platform_developers",
  {
    id: serial("id").primaryKey(),
    platform: varchar("platform", { length: 20 }).notNull(),
    name: text("name").notNull(),
    globalDeveloperId: integer("global_developer_id")
      .notNull()
      .references(() => globalDevelopers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_platform_developers_platform_name").on(
      table.platform,
      table.name
    ),
    index("idx_platform_developers_global_id").on(table.globalDeveloperId),
  ]
);
