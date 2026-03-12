import { pgTable, varchar, integer, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videosTable = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  youtubeId: varchar("youtube_id", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  channelId: varchar("channel_id", { length: 255 }),
  youtubeChannelId: varchar("youtube_channel_id", { length: 255 }),
  youtubeChannelTitle: varchar("youtube_channel_title", { length: 255 }),
  seriesId: varchar("series_id", { length: 255 }),
  seriesName: varchar("series_name", { length: 255 }),
  durationSeconds: integer("duration_seconds").notNull(),
  stimulationLevel: integer("stimulation_level").notNull().default(3),
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  thumbnailUrl: text("thumbnail_url"),
  customThumbnailUrl: text("custom_thumbnail_url"),
  isPublished: integer("is_published").notNull().default(1),
  isEmbeddable: integer("is_embeddable").notNull().default(1),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
