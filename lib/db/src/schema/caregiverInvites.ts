import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const caregiverInvitesTable = pgTable("caregiver_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  parentUserId: uuid("parent_user_id").notNull().references(() => usersTable.id),
  email: varchar("email", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export const insertCaregiverInviteSchema = createInsertSchema(caregiverInvitesTable).omit({ id: true, createdAt: true });
export type InsertCaregiverInvite = z.infer<typeof insertCaregiverInviteSchema>;
export type CaregiverInvite = typeof caregiverInvitesTable.$inferSelect;
