import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { accounts, users } from "./auth.js";
import { trackedKeywords } from "./keywords.js";
import { apps } from "./apps.js";

export const researchProjects = pgTable(
  "research_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 20 }).notNull().default("shopify"),
    name: varchar("name", { length: 255 }).notNull().default("Untitled Research"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_research_projects_account").on(table.accountId),
  ]
);

export const researchProjectKeywords = pgTable(
  "research_project_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchProjectId: uuid("research_project_id")
      .notNull()
      .references(() => researchProjects.id, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_research_project_keywords_unique").on(
      table.researchProjectId,
      table.keywordId
    ),
  ]
);

export const researchProjectCompetitors = pgTable(
  "research_project_competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchProjectId: uuid("research_project_id")
      .notNull()
      .references(() => researchProjects.id, { onDelete: "cascade" }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_research_project_competitors_unique").on(
      table.researchProjectId,
      table.appId
    ),
  ]
);
