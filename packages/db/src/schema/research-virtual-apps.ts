import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { researchProjects } from "./research-projects.js";

export const researchVirtualApps = pgTable(
  "research_virtual_apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchProjectId: uuid("research_project_id")
      .notNull()
      .references(() => researchProjects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull().default("My App"),
    icon: varchar("icon", { length: 10 }).notNull().default("🚀"),
    color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
    iconUrl: text("icon_url"),
    appCardSubtitle: text("app_card_subtitle").notNull().default(""),
    appIntroduction: text("app_introduction").notNull().default(""),
    appDetails: text("app_details").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoMetaDescription: text("seo_meta_description").notNull().default(""),
    features: jsonb("features").notNull().default([]),
    integrations: jsonb("integrations").notNull().default([]),
    languages: jsonb("languages").notNull().default([]),
    categories: jsonb("categories").notNull().default([]),
    pricingPlans: jsonb("pricing_plans").notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_research_virtual_apps_project").on(table.researchProjectId),
  ]
);
