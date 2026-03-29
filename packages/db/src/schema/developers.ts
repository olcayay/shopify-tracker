import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
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
    description: text("description"),
    logoUrl: text("logo_url"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
    totalApps: integer("total_apps").notNull().default(0),
    totalReviews: integer("total_reviews").notNull().default(0),
    avgRating: decimal("avg_rating", { precision: 3, scale: 2 }),
    platformsActive: integer("platforms_active").notNull().default(0),
    enrichedAt: timestamp("enriched_at"),
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
