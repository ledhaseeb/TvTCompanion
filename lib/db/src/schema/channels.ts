import { pgTable, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";

export const channelsTable = pgTable("channels", {
  id: varchar("id").primaryKey(),
  youtubeChannelId: text("youtube_channel_id"),
  name: text("name").notNull(),
  isEnabled: integer("is_enabled").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Channel = typeof channelsTable.$inferSelect;

export const seriesTable = pgTable("series", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  channelId: varchar("channel_id"),
  isEnabled: integer("is_enabled").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Series = typeof seriesTable.$inferSelect;
