import { pgTable, varchar, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { sessionsTable } from "./sessions";

export const watchHistoryTable = pgTable("watch_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: varchar("video_id", { length: 255 }).notNull(),
  childIds: text("child_ids").array().notNull(),
  sessionId: uuid("session_id").notNull().references(() => sessionsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  durationSeconds: integer("duration_seconds").notNull(),
  stimulationLevel: integer("stimulation_level").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWatchHistorySchema = createInsertSchema(watchHistoryTable).omit({ id: true, createdAt: true });
export type InsertWatchHistory = z.infer<typeof insertWatchHistorySchema>;
export type WatchHistory = typeof watchHistoryTable.$inferSelect;
