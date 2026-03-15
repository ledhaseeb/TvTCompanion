import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest, apiRequestRaw } from "@/lib/query-client";
import { useSession, SessionConflictError } from "@/contexts/SessionContext";
import { colors, spacing, borderRadius } from "@/constants/colors";
import type { Video, TaperMode, PlaylistResponse } from "@/lib/types";
import { TAPER_MODES } from "@/lib/types";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

function normalizeVideo(v: Record<string, unknown>): Video {
  return {
    id: (v.id as string) || "",
    youtubeId: (v.youtubeId || v.youtube_id || v.youtube_video_id || "") as string,
    title: (v.title as string) || "",
    channelId: (v.channelId || v.channel_id || null) as string | null,
    youtubeChannelId: (v.youtubeChannelId || v.youtube_channel_id || null) as string | null,
    youtubeChannelTitle: (v.youtubeChannelTitle || v.youtube_channel_title || null) as string | null,
    seriesId: (v.seriesId || v.series_id || null) as string | null,
    seriesName: (v.seriesName || v.series_name || null) as string | null,
    durationSeconds: (v.durationSeconds || v.duration_seconds || 0) as number,
    stimulationLevel: (v.stimulationLevel ?? v.stimulation_level ?? 0) as number,
    ageMin: (v.ageMin ?? v.age_min ?? null) as number | null,
    ageMax: (v.ageMax ?? v.age_max ?? null) as number | null,
    thumbnailUrl: (v.thumbnailUrl || v.thumbnail_url || null) as string | null,
    customThumbnailUrl: (v.customThumbnailUrl || v.custom_thumbnail_url || null) as string | null,
    isPublished: (v.isPublished ?? v.is_published ?? 1) as number,
    isEmbeddable: (v.isEmbeddable ?? v.is_embeddable ?? 1) as number,
  };
}

function normalizeVideos(arr: Record<string, unknown>[]): Video[] {
  return (arr || []).map(normalizeVideo);
}

const DARK = {
  bg: "#0f1923",
  card: "#1a2a3a",
  cardBorder: "#2a3a4a",
  accent: "#2dd4a8",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  progressBg: "#1e293b",
  overflow: "#ef4444",
};

const STIM_LABELS: Record<number, string> = {
  0: "Silent",
  1: "Slow",
  2: "Calm",
  3: "Medium",
  4: "Active",
  5: "Energetic",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDurationLong(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function getTaperLabel(mode: TaperMode): string {
  const found = TAPER_MODES.find((m) => m.value === mode);
  return found ? found.label : mode;
}

function getTaperIcon(mode: TaperMode): FeatherIconName {
  const iconMap: Record<TaperMode, FeatherIconName> = {
    taper_down: "trending-down",
    taper_up: "trending-up",
    taper_up_down: "activity",
    flatline: "minus",
  };
  return iconMap[mode] || "minus";
}

function StimDots({ level }: { level: number }) {
  return (
    <View style={styles.stimDots}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.stimDot,
            {
              backgroundColor:
                i <= level
                  ? colors.stimulation[level] || DARK.textMuted
                  : DARK.cardBorder,
            },
          ]}
        />
      ))}
    </View>
  );
}

function VideoCard({
  video,
  index,
  onReplace,
  onRemove,
}: {
  video: Video;
  index: number;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const thumbnailUrl =
    video.customThumbnailUrl ||
    video.thumbnailUrl ||
    `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;
  const stimLabel = STIM_LABELS[video.stimulationLevel] || "Medium";
  const isHD = video.durationSeconds >= 600;
  const ageLabel = video.ageMin != null ? `${video.ageMin}+` : null;

  return (
    <View style={styles.videoCard}>
      <Image
        source={{ uri: thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoContent}>
        <View style={styles.videoTopRow}>
          <View style={styles.videoInfo}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {video.title}
            </Text>
            <Text style={styles.videoChannel} numberOfLines={1}>
              {video.seriesName || video.youtubeChannelTitle || "Unknown"}
            </Text>
          </View>
          <View style={styles.videoActions}>
            <TouchableOpacity
              onPress={onReplace}
              style={styles.actionBtn}
              testID={`replace-${index}`}
            >
              <Feather name="refresh-cw" size={16} color={DARK.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRemove}
              style={styles.actionBtn}
              testID={`remove-${index}`}
            >
              <Feather name="x" size={16} color={DARK.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.videoMetaRow}>
          <Feather name="clock" size={12} color={DARK.textMuted} />
          <Text style={styles.videoDuration}>
            {formatDuration(video.durationSeconds)}
          </Text>
          <StimDots level={video.stimulationLevel} />
          <Text
            style={[
              styles.stimLabel,
              { color: colors.stimulation[video.stimulationLevel] || DARK.textMuted },
            ]}
          >
            {stimLabel}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles.badgeHD]}>
            <Text style={styles.badgeText}>
              {isHD ? "HD" : "SD"}
            </Text>
          </View>
          {ageLabel && (
            <View style={[styles.badge, styles.badgeAge]}>
              <Text style={styles.badgeText}>{ageLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function WindDownVideoCard({
  video,
  onReplace,
}: {
  video: Video;
  onReplace: () => void;
}) {
  const thumbnailUrl =
    video.customThumbnailUrl ||
    video.thumbnailUrl ||
    `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;
  const stimLabel = STIM_LABELS[video.stimulationLevel] || "Medium";
  const isHD = video.durationSeconds >= 600;
  const ageLabel = video.ageMin != null ? `${video.ageMin}+` : null;

  return (
    <View style={styles.videoCard}>
      <Image
        source={{ uri: thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoContent}>
        <View style={styles.videoTopRow}>
          <View style={styles.videoInfo}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {video.title}
            </Text>
            <Text style={styles.videoChannel} numberOfLines={1}>
              {video.seriesName || video.youtubeChannelTitle || "Unknown"}
            </Text>
          </View>
          <View style={styles.videoActions}>
            <TouchableOpacity
              onPress={onReplace}
              style={styles.actionBtn}
              testID="replace-winddown"
            >
              <Feather name="refresh-cw" size={16} color={DARK.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.videoMetaRow}>
          <Feather name="clock" size={12} color={DARK.textMuted} />
          <Text style={styles.videoDuration}>
            {formatDuration(video.durationSeconds)}
          </Text>
          <StimDots level={video.stimulationLevel} />
          <Text
            style={[
              styles.stimLabel,
              { color: colors.stimulation[video.stimulationLevel] || DARK.textMuted },
            ]}
          >
            {stimLabel}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles.badgeHD]}>
            <Text style={styles.badgeText}>{isHD ? "HD" : "SD"}</Text>
          </View>
          {ageLabel && (
            <View style={[styles.badge, styles.badgeAge]}>
              <Text style={styles.badgeText}>{ageLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function PlaylistPreviewScreen() {
  const params = useLocalSearchParams<{
    childIds: string;
    childNames: string;
    sessionMinutes: string;
    taperMode: string;
    flatlineLevel: string;
    includeWindDown: string;
    finishMode: string;
    youngChildProtection: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSession } = useSession();

  const childIds = params.childIds?.split(",") ?? [];
  const childNames = params.childNames?.split(",") ?? [];
  const sessionMinutes = parseInt(params.sessionMinutes || "30", 10);
  const taperMode = (params.taperMode || "taper_down") as TaperMode;
  const flatlineLevel = parseInt(params.flatlineLevel || "3", 10);
  const finishMode = (params.finishMode || "soft") as "soft" | "hard";

  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [calmingVideos, setCalmingVideos] = useState<Video[]>([]);
  const [replacementCandidates, setReplacementCandidates] = useState<
    Record<number, Video[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [forceNext, setForceNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeWindDown, setIncludeWindDown] = useState(
    params.includeWindDown === "1",
  );

  const fetchPlaylist = useCallback(async () => {
    try {
      const res = await apiRequest("POST", "/api/sessions/playlist", {
        childIds,
        sessionMinutes,
        taperMode,
        flatlineLevel,
      });
      const data = await res.json();
      setPlaylist(normalizeVideos(data.playlist));
      setCalmingVideos(normalizeVideos(data.calmingVideos || data.calming_videos || []));
      const rawCandidates = data.replacementCandidates || data.replacement_candidates || {};
      const normCandidates: Record<number, Video[]> = {};
      for (const [k, v] of Object.entries(rawCandidates)) {
        normCandidates[Number(k)] = normalizeVideos(v as Record<string, unknown>[]);
      }
      setReplacementCandidates(normCandidates);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load playlist");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylist();
  }, []);

  const totalDuration = useMemo(
    () => playlist.reduce((sum, v) => sum + v.durationSeconds, 0),
    [playlist],
  );

  const sessionSeconds = sessionMinutes * 60;
  const overflowSeconds = Math.max(0, totalDuration - sessionSeconds);
  const overflowMinutes = Math.ceil(overflowSeconds / 60);
  const hasOverflow = overflowSeconds > 0;
  const overflowPercent = sessionSeconds > 0 ? (overflowSeconds / sessionSeconds) * 100 : 0;

  const overshootColor = !hasOverflow || overflowPercent < 10
    ? "#22c55e"
    : overflowPercent <= 20
      ? "#f59e0b"
      : "#ef4444";

  const endTime = useMemo(() => {
    const now = new Date();
    now.setSeconds(now.getSeconds() + totalDuration);
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [totalDuration]);

  const avgStim = useMemo(() => {
    if (playlist.length === 0) return 0;
    return Math.round(
      playlist.reduce((sum, v) => sum + v.stimulationLevel, 0) /
        playlist.length,
    );
  }, [playlist]);

  const windDownVideo = calmingVideos.length > 0 ? calmingVideos[0] : null;

  const handleShuffle = async () => {
    setIsShuffling(true);
    try {
      const res = await apiRequest("POST", "/api/sessions/playlist", {
        childIds,
        sessionMinutes,
        taperMode,
        flatlineLevel,
      });
      const data = await res.json();
      setPlaylist(normalizeVideos(data.playlist));
      const calm = data.calmingVideos || data.calming_videos;
      if (calm?.length > 0) {
        setCalmingVideos(normalizeVideos(calm));
      }
      const rc = data.replacementCandidates || data.replacement_candidates;
      if (rc) {
        const normCandidates: Record<number, Video[]> = {};
        for (const [k, v] of Object.entries(rc)) {
          normCandidates[Number(k)] = normalizeVideos(v as Record<string, unknown>[]);
        }
        setReplacementCandidates(normCandidates);
      }
    } catch {
      Alert.alert("Error", "Failed to shuffle playlist");
    } finally {
      setIsShuffling(false);
    }
  };

  const handleReplace = async (index: number) => {
    const currentVideo = playlist[index];
    try {
      const res = await apiRequestRaw("POST", "/api/sessions/playlist/replace", {
        childIds,
        currentPlaylistVideoIds: playlist.map((v) => v.id),
        replaceIndex: index,
        taperMode,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.playlist && Array.isArray(data.playlist)) {
          const normalized = normalizeVideos(data.playlist);
          const replacedVideo = normalized[index];
          if (replacedVideo && replacedVideo.id !== currentVideo.id) {
            setPlaylist(normalized);
            return;
          }
        } else if (data.video) {
          const normalized = normalizeVideo(data.video as Record<string, unknown>);
          if (normalized.id !== currentVideo.id) {
            const newPlaylist = [...playlist];
            newPlaylist[index] = normalized;
            setPlaylist(newPlaylist);
            return;
          }
        }
      }
      if (res.status === 404) {
        Alert.alert("No Alternatives", "No replacement videos available for this position.");
        return;
      }
    } catch {
    }

    const candidates = replacementCandidates[index];
    if (!candidates || candidates.length === 0) {
      Alert.alert("No Alternatives", "No replacement videos available.");
      return;
    }
    const calmingIds = new Set(calmingVideos.map((v) => v.id));
    const playlistIds = new Set(playlist.map((v) => v.id));
    const filtered = candidates.filter(
      (c) =>
        !calmingIds.has(c.id) &&
        !playlistIds.has(c.id) &&
        c.id !== currentVideo.id &&
        c.stimulationLevel >= 1,
    );
    if (filtered.length === 0) {
      Alert.alert("No Alternatives", "No replacement videos available.");
      return;
    }
    const newPlaylist = [...playlist];
    const replacement =
      filtered[Math.floor(Math.random() * filtered.length)];
    newPlaylist[index] = replacement;
    setPlaylist(newPlaylist);
  };

  const handleRemove = (index: number) => {
    if (playlist.length <= 1) {
      Alert.alert("Cannot Remove", "Must keep at least one video.");
      return;
    }
    setPlaylist((prev) => prev.filter((_, i) => i !== index));
  };

  const doStartSession = async (force: boolean) => {
    await startSession({
      childIds,
      childNames,
      playlist,
      calmingVideos: includeWindDown ? calmingVideos : [],
      includeWindDown,
      taperMode,
      flatlineLevel,
      sessionMinutes,
      finishMode,
      force,
    });
    router.push("/(main)/player");
  };

  const handleStart = async () => {
    const useForce = forceNext;
    if (playlist.length === 0) return;
    setIsStarting(true);
    setStartError(null);
    setForceNext(false);
    try {
      await doStartSession(useForce);
      setIsStarting(false);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isConflict = err instanceof SessionConflictError ||
        (err instanceof Error && err.name === "SessionConflictError") ||
        errMsg.includes("active session");
      if (isConflict) {
        setIsStarting(false);
        setStartError(`${errMsg} — Tap "Start Watching" again to override.`);
        setForceNext(true);
        return;
      }
      setStartError(errMsg);
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DARK.accent} />
          <Text style={styles.loadingText}>Building your playlist...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={DARK.overflow} />
          <Text style={styles.errorTitle}>Playlist Error</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setIsLoading(true);
              setError(null);
              fetchPlaylist();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="play" size={18} color={DARK.text} />
          <Text style={styles.headerTitle}>Group Session Preview</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sessionInfoCard}>
          <View style={styles.sessionInfoRow}>
            <View style={styles.sessionInfoCol}>
              <Feather name="settings" size={14} color={DARK.textSecondary} />
              <Text style={styles.sessionInfoLabel}>
                {sessionMinutes}m
              </Text>
            </View>
            <View style={styles.sessionInfoColCenter}>
              <Text
                style={[
                  styles.overshootText,
                  { color: overshootColor },
                ]}
              >
                {hasOverflow ? `+${overflowMinutes}m` : "0m"}
              </Text>
            </View>
            <View style={styles.sessionInfoColRight}>
              <Feather name="clock" size={14} color={DARK.textSecondary} />
              <Text style={styles.endTimeText}>Ends {endTime}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.warningText, !hasOverflow && styles.warningTextMuted]}>
          WARNING: Session length may exceed.{" "}
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>⇄ Shuffle</Text>,{" "}
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>↻ Replace</Text>{" "}
          or{" "}
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>✕ Remove</Text>{" "}
          videos to fit your requirement.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="clock" size={13} color={DARK.accent} />
            <Text style={[styles.statText, { color: DARK.accent }]}>
              {formatDurationLong(totalDuration)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Feather name="zap" size={13} color={DARK.textSecondary} />
            <Text style={styles.statText}>Stim: {avgStim}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statText}>
              {playlist.length} video{playlist.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Feather
              name={getTaperIcon(taperMode)}
              size={13}
              color={DARK.textSecondary}
            />
            <Text style={styles.statText}>{getTaperLabel(taperMode)}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>MAIN PLAYLIST</Text>
          <TouchableOpacity
            onPress={handleShuffle}
            style={styles.shuffleButton}
            disabled={isShuffling}
            testID="button-shuffle"
          >
            {isShuffling ? (
              <ActivityIndicator size="small" color={DARK.text} />
            ) : (
              <>
                <Feather name="shuffle" size={16} color={DARK.text} />
                <Text style={styles.shuffleText}>Shuffle</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {playlist.map((video, index) => (
          <VideoCard
            key={`${video.id}-${index}`}
            video={video}
            index={index}
            onReplace={() => handleReplace(index)}
            onRemove={() => handleRemove(index)}
          />
        ))}

        <View style={styles.windDownSection}>
          <View style={styles.windDownToggleRow}>
            <View style={styles.windDownLeft}>
              <Feather name="moon" size={16} color={DARK.textSecondary} />
              <Text style={styles.windDownToggleLabel}>Include wind-down</Text>
            </View>
            <Switch
              value={includeWindDown}
              onValueChange={setIncludeWindDown}
              trackColor={{ false: DARK.cardBorder, true: DARK.accent }}
              thumbColor={DARK.text}
              testID="switch-wind-down"
            />
          </View>

          {includeWindDown && windDownVideo && (
            <>
              <View style={styles.windDownHeader}>
                <View style={styles.windDownDot} />
                <Text style={styles.windDownLabel}>WIND-DOWN VIDEO</Text>
                <Text style={styles.windDownSub}>
                  Plays after the daily limit
                </Text>
              </View>
              <WindDownVideoCard
                video={windDownVideo}
                onReplace={async () => {
                  try {
                    const res = await apiRequest("POST", "/api/sessions/playlist/replace-calming", {
                      childIds,
                      currentCalmingVideoId: windDownVideo.id,
                    });
                    const data = await res.json();
                    if (data.calmingVideos && data.calmingVideos.length > 0) {
                      setCalmingVideos(data.calmingVideos);
                      return;
                    }
                  } catch {
                  }

                  if (calmingVideos.length > 1) {
                    const others = calmingVideos.slice(1);
                    const replacement =
                      others[Math.floor(Math.random() * others.length)];
                    setCalmingVideos([replacement, ...calmingVideos.filter((v) => v.id !== replacement.id)]);
                  } else {
                    Alert.alert(
                      "No Alternatives",
                      "No other wind-down videos available.",
                    );
                  }
                }}
              />
            </>
          )}
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        {startError && (
          <Text style={{ color: "#ef4444", fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", marginBottom: 8 }}>
            {startError}
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.startButton,
            (isStarting || playlist.length === 0) && styles.startButtonDisabled,
          ]}
          onPress={handleStart}
          disabled={isStarting || playlist.length === 0}
          activeOpacity={0.8}
          testID="button-start"
        >
          {isStarting ? (
            <ActivityIndicator color={DARK.bg} />
          ) : (
            <>
              <Feather name="play" size={18} color={DARK.bg} />
              <Text style={styles.startButtonText}>Start Watching</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelButton}
          testID="button-cancel"
        >
          <Text style={styles.cancelButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: DARK.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
  },
  errorDetail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: DARK.accent,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: DARK.bg,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.sm,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: DARK.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DARK.card,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 220,
  },
  sessionInfoCard: {
    backgroundColor: DARK.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: DARK.cardBorder,
  },
  sessionInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionInfoCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sessionInfoColCenter: {
    alignItems: "center",
  },
  sessionInfoColRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sessionInfoLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
  },
  overshootText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  endTimeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
  },
  warningText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  warningTextMuted: {
    opacity: 0.35,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: DARK.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: DARK.textMuted,
    letterSpacing: 1,
  },
  shuffleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: DARK.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: DARK.cardBorder,
  },
  shuffleText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: DARK.text,
  },
  videoCard: {
    flexDirection: "row",
    backgroundColor: DARK.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: DARK.cardBorder,
    overflow: "hidden",
  },
  thumbnail: {
    width: 90,
    height: 90,
    backgroundColor: DARK.progressBg,
  },
  videoContent: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: "space-between",
  },
  videoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  videoInfo: {
    flex: 1,
    marginRight: spacing.xs,
  },
  videoTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
    marginBottom: 2,
  },
  videoChannel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: DARK.textMuted,
  },
  videoActions: {
    flexDirection: "row",
    gap: 4,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  videoMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  videoDuration: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
  },
  stimDots: {
    flexDirection: "row",
    gap: 3,
  },
  stimDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  stimLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeHD: {
    backgroundColor: "rgba(45, 212, 168, 0.15)",
  },
  badgeAge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: DARK.accent,
  },
  windDownSection: {
    marginTop: spacing.md,
  },
  windDownToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  windDownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  windDownToggleLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: DARK.text,
  },
  windDownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  windDownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DARK.textMuted,
  },
  windDownLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: DARK.textMuted,
    letterSpacing: 1,
  },
  windDownSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: DARK.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: DARK.bg,
    borderTopWidth: 1,
    borderTopColor: DARK.cardBorder,
  },
  startButton: {
    backgroundColor: DARK.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startButtonDisabled: {
    opacity: 0.3,
  },
  startButtonText: {
    color: DARK.bg,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: DARK.card,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: DARK.cardBorder,
  },
  cancelButtonText: {
    color: DARK.text,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  backLinkText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: DARK.textSecondary,
  },
});
