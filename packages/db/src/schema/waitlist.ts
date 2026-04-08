import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    referrer: varchar("referrer", { length: 512 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_waitlist_email").on(table.email),
    index("idx_waitlist_created_at").on(table.createdAt),
  ]
);
