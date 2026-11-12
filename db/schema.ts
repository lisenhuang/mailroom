import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const attempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
export const drafts = sqliteTable("drafts", {
  owner: text("owner").primaryKey(),
  data: text("data").notNull(),
  updated: integer("updated").notNull(),
});
export const sends = sqliteTable("sends", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  fingerprint: text("fingerprint").notNull(),
  data: text("data").notNull(),
  status: text("status").notNull(),
  result: text("result"),
  created: integer("created").notNull(),
});

export const domainPreferences = sqliteTable(
  "domain_preferences",
  {
    owner: text("owner").notNull(),
    domain: text("domain").notNull(),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.owner, table.domain] })],
);
