import { pgTable, varchar, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";

export const sessionFeedbackTable = pgTable("session_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessionsTable.id),
  skipped: boolean("skipped").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const behaviorRatingsTable = pgTable("behavior_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id").notNull().references(() => sessionFeedbackTable.id),
  childId: uuid("child_id").notNull(),
  behaviorRating: varchar("behavior_rating", { length: 50 }).notNull(),
  participationPct: integer("participation_pct").notNull().default(100),
});

export const insertFeedbackSchema = createInsertSchema(sessionFeedbackTable).omit({ id: true, createdAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof sessionFeedbackTable.$inferSelect;

export const insertBehaviorRatingSchema = createInsertSchema(behaviorRatingsTable).omit({ id: true });
export type InsertBehaviorRating = z.infer<typeof insertBehaviorRatingSchema>;
export type BehaviorRatingRecord = typeof behaviorRatingsTable.$inferSelect;
