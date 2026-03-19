import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, sessionsTable, videosTable, watchHistoryTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

type Video = typeof videosTable.$inferSelect;

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getSeriesKey(v: Video): string {
  return v.seriesId
    ? `series:${v.seriesId}`
    : v.youtubeChannelId
      ? `yt:${v.youtubeChannelId}`
      : v.channelId
        ? `channel:${v.channelId}`
        : `v:${v.id}`;
}

function seriesLevelShuffle(videos: Video[]): Video[] {
  if (videos.length === 0) return [];
  const groups = new Map<string, Video[]>();
  for (const video of videos) {
    const key = getSeriesKey(video);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(video);
  }
  const groupKeys = fisherYatesShuffle(Array.from(groups.keys()));
  const shuffledGroups: Video[][] = [];
  for (const key of groupKeys) {
    shuffledGroups.push(fisherYatesShuffle(groups.get(key)!));
  }
  const result: Video[] = [];
  let added = true;
  let round = 0;
  while (added) {
    added = false;
    for (const group of shuffledGroups) {
      if (round < group.length) {
        result.push(group[round]);
        added = true;
      }
    }
    round++;
  }
  return result;
}

function getVisibleVideos(allVideos: Video[]): Video[] {
  return allVideos.filter(v =>
    v.isPublished === 1 &&
    v.isEmbeddable !== 0
  );
}

function formatVideo(v: Video) {
  return {
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
  };
}

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

  const allVideos = await db.select().from(videosTable);
  const visibleVideos = getVisibleVideos(allVideos);

  if (visibleVideos.length === 0) {
    res.json({ playlist: [], calmingVideos: [], replacementCandidates: {} });
    return;
  }

  const calmingVideos = visibleVideos.filter(v => v.stimulationLevel === 0);
  const shuffledCalming = seriesLevelShuffle(calmingVideos).slice(0, 5);

  const entertainmentVideos = visibleVideos.filter(v => v.stimulationLevel >= 1 && v.stimulationLevel <= 5);

  const maxStim = 5;
  let shuffled: Video[];
  if (taperMode === "flatline") {
    const fl = flatlineLevel ?? 3;
    const eligibleEntertainment = entertainmentVideos.filter(
      v => v.stimulationLevel >= Math.max(1, fl - 1) && v.stimulationLevel <= Math.min(maxStim, fl + 1)
    );
    shuffled = seriesLevelShuffle(eligibleEntertainment);
  } else {
    shuffled = seriesLevelShuffle(entertainmentVideos.filter(v => v.stimulationLevel <= maxStim));
  }

  let playlist: Video[] = [];
  let accumulatedSeconds = 0;
  const usedVideoIds = new Set<string>();

  for (const video of shuffled) {
    if (accumulatedSeconds >= totalSeconds) break;
    if (usedVideoIds.has(video.id)) continue;
    usedVideoIds.add(video.id);
    playlist.push(video);
    accumulatedSeconds += video.durationSeconds;
  }

  switch (taperMode) {
    case "taper_down":
      playlist.sort((a, b) => b.stimulationLevel - a.stimulationLevel);
      break;
    case "taper_up":
      playlist.sort((a, b) => a.stimulationLevel - b.stimulationLevel);
      break;
    case "taper_up_down": {
      playlist.sort((a, b) => a.stimulationLevel - b.stimulationLevel);
      const midpoint = Math.ceil(playlist.length / 2);
      const ascending = playlist.slice(0, midpoint);
      const descending = playlist.slice(midpoint).sort((a, b) => b.stimulationLevel - a.stimulationLevel);
      playlist = [...ascending, ...descending];
      break;
    }
    case "flatline":
      break;
  }

  const playlistIds = new Set(playlist.map(v => v.id));
  const replacementCandidates: Record<number, Video[]> = {};
  for (const v of shuffled) {
    if (playlistIds.has(v.id)) continue;
    const stim = v.stimulationLevel;
    if (stim < 1) continue;
    if (!replacementCandidates[stim]) replacementCandidates[stim] = [];
    if (replacementCandidates[stim].length < 5) {
      replacementCandidates[stim].push(v);
    }
  }

  res.json({
    playlist: playlist.map(formatVideo),
    calmingVideos: shuffledCalming.map(formatVideo),
    replacementCandidates: Object.fromEntries(
      Object.entries(replacementCandidates).map(([k, v]) => [k, v.map(formatVideo)])
    ),
  });
});

router.post("/sessions/playlist/replace", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { childIds, currentPlaylistVideoIds, replaceIndex, taperMode } = req.body;

  if (!currentPlaylistVideoIds || replaceIndex == null) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const allVideos = await db.select().from(videosTable);
  const visibleVideos = getVisibleVideos(allVideos);
  const videoMap = new Map(visibleVideos.map(v => [v.id, v]));

  const currentPlaylist = (currentPlaylistVideoIds as string[])
    .map((id: string) => videoMap.get(id))
    .filter((v): v is Video => v !== undefined);

  const currentVideo = currentPlaylist[replaceIndex];
  if (!currentVideo) {
    res.status(404).json({ error: "No video at that index" });
    return;
  }

  const currentStim = currentVideo.stimulationLevel;
  const playlistShowKeys = new Set(currentPlaylist.map(v => getSeriesKey(v)));
  const currentShowKey = getSeriesKey(currentVideo);
  playlistShowKeys.delete(currentShowKey);

  const playlistVideoIds = new Set(currentPlaylist.map(v => v.id));
  const regularVideos = visibleVideos.filter(v => {
    if (playlistVideoIds.has(v.id)) return false;
    if (v.stimulationLevel < 1 || v.stimulationLevel > 5) return false;
    if (playlistShowKeys.has(getSeriesKey(v))) return false;
    return true;
  });

  const prevStim = replaceIndex > 0 ? currentPlaylist[replaceIndex - 1].stimulationLevel : null;
  const nextStim = replaceIndex < currentPlaylist.length - 1 ? currentPlaylist[replaceIndex + 1].stimulationLevel : null;
  let minStim = Math.max(1, currentStim - 1);
  let maxStimAllowed = Math.min(5, currentStim + 1);

  const mode = taperMode || "taper_down";
  if (mode === "taper_down") {
    if (prevStim !== null) maxStimAllowed = Math.min(maxStimAllowed, prevStim);
    if (nextStim !== null && nextStim > 0) minStim = Math.max(1, nextStim);
  } else if (mode === "taper_up") {
    if (prevStim !== null) minStim = Math.max(minStim, prevStim);
    if (nextStim !== null) maxStimAllowed = Math.min(maxStimAllowed, nextStim);
  } else if (mode === "taper_up_down") {
    let peakIdx = 0;
    let peakVal = 0;
    currentPlaylist.forEach((v, i) => {
      if (v.stimulationLevel > peakVal) { peakVal = v.stimulationLevel; peakIdx = i; }
    });
    if (replaceIndex <= peakIdx) {
      if (prevStim !== null) minStim = Math.max(minStim, prevStim);
      if (nextStim !== null) maxStimAllowed = Math.min(maxStimAllowed, nextStim + 1);
    } else {
      if (prevStim !== null) maxStimAllowed = Math.min(maxStimAllowed, prevStim);
      if (nextStim !== null && nextStim > 0) minStim = Math.max(1, nextStim);
    }
  }

  if (minStim > maxStimAllowed) {
    minStim = currentStim;
    maxStimAllowed = currentStim;
  }

  let candidates = regularVideos.filter(v => v.stimulationLevel >= minStim && v.stimulationLevel <= maxStimAllowed);
  if (candidates.length === 0) candidates = regularVideos;
  if (candidates.length === 0) {
    res.status(404).json({ error: "No replacement video found" });
    return;
  }

  const showGroups = new Map<string, Video[]>();
  for (const v of candidates) {
    const key = getSeriesKey(v);
    if (!showGroups.has(key)) showGroups.set(key, []);
    showGroups.get(key)!.push(v);
  }
  const showKeysList = Array.from(showGroups.keys());
  const chosenShowKey = showKeysList[Math.floor(Math.random() * showKeysList.length)];
  const showVids = showGroups.get(chosenShowKey)!;
  const replacement = showVids[Math.floor(Math.random() * showVids.length)];

  const updatedPlaylist = [...currentPlaylist];
  updatedPlaylist[replaceIndex] = replacement;

  res.json({
    video: formatVideo(replacement),
    playlist: updatedPlaylist.map(formatVideo),
  });
});

router.post("/sessions/playlist/replace-calming", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { childIds, currentCalmingVideoId } = req.body;

  const allVideos = await db.select().from(videosTable);
  const visibleVideos = getVisibleVideos(allVideos);

  const calmingVideos = visibleVideos
    .filter(v => v.stimulationLevel === 0 && v.id !== currentCalmingVideoId);

  const shuffled = seriesLevelShuffle(calmingVideos);

  res.json({
    calmingVideos: shuffled.slice(0, 5).map(formatVideo),
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
