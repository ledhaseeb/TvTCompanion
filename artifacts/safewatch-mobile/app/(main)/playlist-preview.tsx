import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/query-client";
import { useSession } from "@/contexts/SessionContext";
import { colors, spacing, borderRadius } from "@/constants/colors";
import type { Video, TaperMode, PlaylistResponse } from "@/lib/types";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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
                  ? colors.stimulation[level] || colors.textTertiary
                  : colors.border,
            },
          ]}
        />
      ))}
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
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSession } = useSession();

  const childIds = params.childIds?.split(",") ?? [];
  const childNames = params.childNames?.split(",") ?? [];
  const sessionMinutes = parseInt(params.sessionMinutes || "30", 10);
  const taperMode = (params.taperMode || "taper_down") as TaperMode;
  const flatlineLevel = parseInt(params.flatlineLevel || "3", 10);
  const includeWindDown = params.includeWindDown === "1";
  const finishMode = (params.finishMode || "soft") as "soft" | "hard";

  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [calmingVideos, setCalmingVideos] = useState<Video[]>([]);
  const [replacementCandidates, setReplacementCandidates] = useState<
    Record<number, Video[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylist = useCallback(async () => {
    try {
      const res = await apiRequest("POST", "/api/sessions/playlist", {
        childIds,
        sessionMinutes,
        taperMode,
        flatlineLevel,
      });
      const data: PlaylistResponse = await res.json();
      setPlaylist(data.playlist);
      setCalmingVideos(data.calmingVideos || []);
      setReplacementCandidates(data.replacementCandidates || {});
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load playlist");
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

  const handleShuffle = async () => {
    setIsShuffling(true);
    try {
      const res = await apiRequest("POST", "/api/sessions/playlist", {
        childIds,
        sessionMinutes,
        taperMode,
        flatlineLevel,
      });
      const data: PlaylistResponse = await res.json();
      setPlaylist(data.playlist);
      if (data.calmingVideos?.length > 0) {
        setCalmingVideos(data.calmingVideos);
      }
      if (data.replacementCandidates) {
        setReplacementCandidates(data.replacementCandidates);
      }
    } catch {
      Alert.alert("Error", "Failed to shuffle playlist");
    } finally {
      setIsShuffling(false);
    }
  };

  const handleReplace = async (index: number) => {
    const candidates = replacementCandidates[index];
    if (!candidates || candidates.length === 0) {
      Alert.alert("No Alternatives", "No replacement videos available.");
      return;
    }
    const newPlaylist = [...playlist];
    const replacement =
      candidates[Math.floor(Math.random() * candidates.length)];
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

  const handleStart = async () => {
    if (playlist.length === 0) return;
    setIsStarting(true);
    try {
      await startSession({
        childIds,
        childNames,
        playlist,
        calmingVideos,
        includeWindDown,
        taperMode,
        flatlineLevel,
        sessionMinutes,
        finishMode,
      });
      router.push("/(main)/player");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start session");
    } finally {
      setIsStarting(false);
    }
  };

  const renderVideo = ({
    item,
    index,
  }: {
    item: Video;
    index: number;
  }) => (
    <View style={styles.videoCard}>
      <View style={styles.videoIndex}>
        <Text style={styles.videoIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.videoMeta}>
          <Text style={styles.videoDuration}>
            {formatDuration(item.durationSeconds)}
          </Text>
          <StimDots level={item.stimulationLevel} />
        </View>
      </View>
      <View style={styles.videoActions}>
        <TouchableOpacity
          onPress={() => handleReplace(index)}
          style={styles.actionBtn}
          testID={`replace-${index}`}
        >
          <Feather name="refresh-cw" size={16} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleRemove(index)}
          style={styles.actionBtn}
          testID={`remove-${index}`}
        >
          <Feather name="x" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Building your playlist...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={colors.error} />
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          testID="button-back"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Playlist</Text>
        <TouchableOpacity
          onPress={handleShuffle}
          style={styles.shuffleButton}
          disabled={isShuffling}
          testID="button-shuffle"
        >
          {isShuffling ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="shuffle" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Feather name="film" size={14} color={colors.textSecondary} />
          <Text style={styles.summaryText}>
            {playlist.length} video{playlist.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Feather name="clock" size={14} color={colors.textSecondary} />
          <Text style={styles.summaryText}>
            {formatDuration(totalDuration)}
          </Text>
        </View>
      </View>

      <FlatList
        data={playlist}
        renderItem={renderVideo}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={playlist.length > 0}
      />

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <TouchableOpacity
          style={[
            styles.startBtn,
            (isStarting || playlist.length === 0) && styles.startBtnDisabled,
          ]}
          onPress={handleStart}
          disabled={isStarting || playlist.length === 0}
          activeOpacity={0.8}
          testID="button-start"
        >
          {isStarting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Feather name="play" size={20} color={colors.white} />
              <Text style={styles.startBtnText}>Start Session</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textSecondary,
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
    color: colors.text,
  },
  errorDetail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  shuffleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8f0fe",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryBar: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  videoIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndexText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: colors.textSecondary,
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: colors.text,
    marginBottom: 4,
  },
  videoMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  videoDuration: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
  },
  stimDots: {
    flexDirection: "row",
    gap: 2,
  },
  stimDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  videoActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startBtnText: {
    color: colors.white,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});
