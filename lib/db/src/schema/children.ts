import { pgTable, varchar, integer, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const childrenTable = pgTable("children", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  birthMonth: integer("birth_month").notNull(),
  birthYear: integer("birth_year").notNull(),
  entertainmentMinutes: integer("entertainment_minutes").notNull().default(30),
  ageRestrictionOverride: integer("age_restriction_override"),
  favouritesAgeBypass: integer("favourites_age_bypass").notNull().default(0),
  eveningProtectionEnabled: integer("evening_protection_enabled").notNull().default(0),
  eveningProtectionStartHour: integer("evening_protection_start_hour").notNull().default(19),
  eveningProtectionMaxStim: integer("evening_protection_max_stim").notNull().default(2),
  sensitivity: varchar("sensitivity", { length: 50 }),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({ id: true });
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
