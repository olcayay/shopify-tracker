import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { accounts } from "./auth.js";
import { trackedKeywords } from "./keywords.js";

export const keywordTags = pgTable(
  "keyword_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_keyword_tags_account_name").on(
      table.accountId,
      table.name
    ),
  ]
);

export const keywordTagAssignments = pgTable(
  "keyword_tag_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => keywordTags.id, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => trackedKeywords.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_keyword_tag_assignments_unique").on(
      table.tagId,
      table.keywordId
    ),
    index("idx_keyword_tag_assignments_keyword").on(table.keywordId),
  ]
);
