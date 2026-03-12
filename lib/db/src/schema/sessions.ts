import { pgTable, varchar, integer, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  childIds: text("child_ids").array().notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  totalMinutesWatched: numeric("total_minutes_watched").notNull().default("0"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  taperMode: varchar("taper_mode", { length: 50 }).notNull(),
  flatlineLevel: integer("flatline_level").notNull().default(3),
  includeWindDown: integer("include_wind_down").notNull().default(1),
  finishMode: varchar("finish_mode", { length: 50 }).notNull().default("soft"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, startTime: true, status: true, totalMinutesWatched: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
