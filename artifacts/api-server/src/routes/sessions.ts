import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, sessionsTable, videosTable, watchHistoryTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router: IRouter = Router();

router.post("/sessions/playlist", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { childIds, sessionMinutes, taperMode, flatlineLevel } = req.body;

  if (!childIds || !sessionMinutes || !taperMode) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const totalSeconds = sessionMinutes * 60;

  const allVideos = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.isPublished, 1));

  if (allVideos.length === 0) {
    res.json({ playlist: [], calmingVideos: [], replacementCandidates: {} });
    return;
  }

  const shuffled = [...allVideos].sort(() => Math.random() - 0.5);

  let playlist: typeof allVideos = [];
  let accumulatedSeconds = 0;

  for (const video of shuffled) {
    if (accumulatedSeconds >= totalSeconds) break;
    playlist.push(video);
    accumulatedSeconds += video.durationSeconds;
  }

  if (taperMode === "taper_down") {
    playlist.sort((a, b) => b.stimulationLevel - a.stimulationLevel);
  } else if (taperMode === "taper_up") {
    playlist.sort((a, b) => a.stimulationLevel - b.stimulationLevel);
  } else if (taperMode === "taper_up_down") {
    const mid = Math.floor(playlist.length / 2);
    const first = playlist.slice(0, mid).sort((a, b) => a.stimulationLevel - b.stimulationLevel);
    const second = playlist.slice(mid).sort((a, b) => b.stimulationLevel - a.stimulationLevel);
    playlist = [...first, ...second];
  }

  const calmingVideos = allVideos
    .filter(v => v.stimulationLevel <= 2)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const replacementCandidates: Record<number, typeof allVideos> = {};
  playlist.forEach((video, index) => {
    const candidates = allVideos
      .filter(v => v.id !== video.id && Math.abs(v.stimulationLevel - video.stimulationLevel) <= 1)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    if (candidates.length > 0) {
      replacementCandidates[index] = candidates;
    }
  });

  const formatVideo = (v: typeof allVideos[0]) => ({
    id: v.id,
    youtubeId: v.youtubeId,
    title: v.title,
    channelId: v.channelId,
    youtubeChannelId: v.youtubeChannelId,
    youtubeChannelTitle: v.youtubeChannelTitle,
    seriesId: v.seriesId,
    seriesName: v.seriesName,
    durationSeconds: v.durationSeconds,
    stimulationLevel: v.stimulationLevel,
    ageMin: v.ageMin,
    ageMax: v.ageMax,
    thumbnailUrl: v.thumbnailUrl,
    customThumbnailUrl: v.customThumbnailUrl,
    isPublished: v.isPublished,
    isEmbeddable: v.isEmbeddable,
  });

  res.json({
    playlist: playlist.map(formatVideo),
    calmingVideos: calmingVideos.map(formatVideo),
    replacementCandidates: Object.fromEntries(
      Object.entries(replacementCandidates).map(([k, v]) => [k, v.map(formatVideo)])
    ),
  });
});

router.post("/sessions", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { childIds, totalDurationSeconds, taperMode, flatlineLevel, includeWindDown, finishMode } = req.body;

  if (!childIds || !totalDurationSeconds || !taperMode) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const activeSessions = await db
    .select()
    .from(sessionsTable)
    .where(and(
      eq(sessionsTable.userId, req.userId),
      eq(sessionsTable.status, "active"),
      isNull(sessionsTable.endTime),
    ));

  if (activeSessions.length > 0) {
    for (const session of activeSessions) {
      await db
        .update(sessionsTable)
        .set({ status: "ended", endTime: new Date() })
        .where(eq(sessionsTable.id, session.id));
    }
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: req.userId,
      childIds,
      taperMode,
      flatlineLevel: flatlineLevel || 3,
      includeWindDown: includeWindDown ? 1 : 0,
      finishMode: finishMode || "soft",
    })
    .returning();

  res.status(201).json({
    id: session.id,
    userId: session.userId,
    childIds: session.childIds,
    startTime: session.startTime.toISOString(),
    endTime: null,
    totalMinutesWatched: 0,
    status: session.status,
    taperMode: session.taperMode,
    flatlineLevel: session.flatlineLevel,
    includeWindDown: session.includeWindDown,
    finishMode: session.finishMode,
  });
});

router.patch("/sessions/:id", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { endedAt, totalDurationSeconds } = req.body;

  const updates: Record<string, unknown> = {};
  if (endedAt) {
    updates.endTime = new Date(endedAt);
    updates.status = "ended";
  }
  if (totalDurationSeconds != null) {
    updates.totalMinutesWatched = String(Math.round(totalDurationSeconds / 60));
  }

  const [session] = await db
    .update(sessionsTable)
    .set(updates)
    .where(eq(sessionsTable.id, raw))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    id: session.id,
    userId: session.userId,
    childIds: session.childIds,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime?.toISOString() || null,
    totalMinutesWatched: Number(session.totalMinutesWatched),
    status: session.status,
    taperMode: session.taperMode,
    flatlineLevel: session.flatlineLevel,
    includeWindDown: session.includeWindDown,
    finishMode: session.finishMode,
  });
});

router.post("/watch-history", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { videoId, childIds, sessionId, durationSeconds, stimulationLevel } = req.body;

  const [entry] = await db
    .insert(watchHistoryTable)
    .values({
      videoId,
      childIds: childIds || [],
      sessionId,
      userId: req.userId,
      durationSeconds,
      stimulationLevel,
    })
    .returning();

  res.status(201).json({
    id: entry.id,
    videoId: entry.videoId,
    sessionId: entry.sessionId,
    durationSeconds: entry.durationSeconds,
    stimulationLevel: entry.stimulationLevel,
    createdAt: entry.createdAt.toISOString(),
  });
});

export default router;
