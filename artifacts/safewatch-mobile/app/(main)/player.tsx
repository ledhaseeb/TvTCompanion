import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import YoutubePlayer from "react-native-youtube-iframe";
import { useSession } from "@/contexts/SessionContext";
import { useCast } from "@/contexts/CastContext";
import type { ReceiverMessage, CastStatusMessage } from "@/contexts/CastContext";
import { apiRequest } from "@/lib/query-client";
import { colors, spacing, borderRadius } from "@/constants/colors";

function extractYoutubeIdFromThumbnail(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/img\.youtube\.com\/vi\/([^/]+)/);
  return match ? match[1] : null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const FEEDBACK_PATH = "/(main)/session-feedback";

export default function PlayerScreen() {
  const router = useRouter();
  const {
    session,
    advanceVideo,
    endSession,
    updateWatchTime,
    setCurrentIndex,
  } = useSession();
  const {
    isCasting,
    isAvailable,
    deviceName,
    loadPlaylist,
    skipVideo,
    pauseMedia,
    playMedia,
    stopMedia,
    requestSession,
    endCastSession,
    onReceiverMessage,
    NativeCastButton,
  } = useCast();

  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const watchStartRef = useRef(Date.now());
  const totalWatchedRef = useRef(0);
  const justAdvancedRef = useRef(false);
  const castPlaylistSentRef = useRef(false);
  const castElapsedRef = useRef(0);

  const { width: screenWidth } = Dimensions.get("window");
  const playerHeight = Math.round((screenWidth * 9) / 16);

  useEffect(() => {
    if (session.isActive && session.playlist.length > 0) {
      setReady(true);
    }
  }, [session.isActive, session.playlist.length]);

  const rawVideo =
    session.playlist.length > 0
      ? session.playlist[session.currentIndex]
      : null;

  const currentVideo = rawVideo
    ? {
        ...rawVideo,
        youtubeId:
          rawVideo.youtubeId ||
          extractYoutubeIdFromThumbnail(rawVideo.thumbnailUrl) ||
          "",
      }
    : null;

  const sessionTotalSeconds = session.sessionMinutes * 60;

  useEffect(() => {
    if (isCasting) return;
    if (!playing) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const totalSeconds =
        totalWatchedRef.current +
        Math.floor((now - watchStartRef.current) / 1000);
      setElapsed(totalSeconds);
      updateWatchTime(totalSeconds);

      if (
        session.finishMode === "hard" &&
        totalSeconds >= sessionTotalSeconds
      ) {
        handleSessionEnd();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [playing, session.finishMode, sessionTotalSeconds, isCasting]);

  useEffect(() => {
    if (isCasting && session.isActive && session.playlist.length > 0 && !castPlaylistSentRef.current) {
      castPlaylistSentRef.current = true;
      loadPlaylist(session.playlist, session.currentIndex);
    }
  }, [isCasting, session.isActive, session.playlist.length]);

  const wasCastingRef = useRef(false);

  useEffect(() => {
    if (!isCasting && wasCastingRef.current) {
      totalWatchedRef.current = castElapsedRef.current;
      watchStartRef.current = Date.now();
      setElapsed(castElapsedRef.current);
      setPlaying(true);
    }
    wasCastingRef.current = isCasting;

    if (!isCasting) {
      castPlaylistSentRef.current = false;
    }
  }, [isCasting]);

  useEffect(() => {
    if (!isCasting) return;

    const unsubscribe = onReceiverMessage((msg: ReceiverMessage) => {
      switch (msg.type) {
        case "STATUS": {
          const status = msg as CastStatusMessage;
          setPlaying(status.isPlaying);
          if (status.currentIndex !== session.currentIndex) {
            setCurrentIndex(status.currentIndex);
          }
          castElapsedRef.current = status.elapsedSeconds;
          setElapsed(status.elapsedSeconds);
          updateWatchTime(status.elapsedSeconds);

          if (
            session.finishMode === "hard" &&
            status.elapsedSeconds >= sessionTotalSeconds
          ) {
            handleSessionEnd();
          }
          break;
        }

        case "VIDEO_ENDED":
          recordWatchHistory();
          break;

        case "VIDEO_ERROR":
          console.warn("[Cast] Video error on receiver:", msg);
          break;

        case "SESSION_COMPLETE":
          handleSessionEnd();
          break;

        case "SESSION_STOPPED":
          break;
      }
    });

    return unsubscribe;
  }, [isCasting, session.currentIndex, session.finishMode, sessionTotalSeconds]);

  const handleStateChange = useCallback(
    (state: string) => {
      if (state === "ended") {
        justAdvancedRef.current = true;
        recordWatchHistory();
        advanceVideo();
      } else if (state === "paused") {
        if (justAdvancedRef.current) {
          return;
        }
        totalWatchedRef.current += Math.floor((Date.now() - watchStartRef.current) / 1000);
        setPlaying(false);
      } else if (state === "playing") {
        justAdvancedRef.current = false;
        watchStartRef.current = Date.now();
        setPlaying(true);
      } else if (state === "buffering" || state === "video cued") {
        justAdvancedRef.current = false;
      }
    },
    [currentVideo, session.sessionId],
  );

  const handlePlayerError = useCallback(
    (error: string) => {
      console.warn("[Player] YouTube error:", error, "videoId:", currentVideo?.youtubeId);
      Alert.alert(
        "Video Unavailable",
        `"${currentVideo?.title}" couldn't be played. Skipping to next video.`,
        [
          {
            text: "OK",
            onPress: () => advanceVideo(),
          },
        ],
      );
    },
    [currentVideo, advanceVideo],
  );

  const recordWatchHistory = async () => {
    if (!currentVideo || !session.sessionId) return;
    try {
      await apiRequest("POST", "/api/watch-history", {
        videoId: currentVideo.youtubeId,
        childIds: session.childIds,
        sessionId: session.sessionId,
        durationSeconds: currentVideo.durationSeconds,
        stimulationLevel: currentVideo.stimulationLevel,
      });
    } catch {}
  };

  const handleSessionEnd = useCallback(async () => {
    await recordWatchHistory();
    if (isCasting) {
      try { await stopMedia(); } catch {}
    }
    await endSession();
    // @ts-expect-error -- expo-router typed routes don't cover dynamic params
    router.replace({
      pathname: FEEDBACK_PATH,
      params: {
        sessionId: session.sessionId || "",
        childIds: session.childIds.join(","),
        childNames: session.childNames.join(","),
      },
    });
  }, [session.sessionId, session.childIds, session.childNames, isCasting, stopMedia]);

  const handleEndPress = () => {
    Alert.alert("End Session", "Are you sure you want to end this session?", [
      { text: "Cancel", style: "cancel" },
      { text: "End Session", style: "destructive", onPress: handleSessionEnd },
    ]);
  };

  const handleSkip = () => {
    recordWatchHistory();
    if (isCasting) {
      skipVideo();
    } else {
      advanceVideo();
    }
  };

  const handleCastPlayPause = () => {
    if (playing) {
      pauseMedia();
      setPlaying(false);
    } else {
      playMedia();
      setPlaying(true);
    }
  };

  useEffect(() => {
    if (!session.isActive && session.sessionId) {
      // @ts-expect-error -- expo-router typed routes don't cover dynamic params
      router.replace({
        pathname: FEEDBACK_PATH,
        params: {
          sessionId: session.sessionId,
          childIds: session.childIds.join(","),
          childNames: session.childNames.join(","),
        },
      });
    }
  }, [session.isActive, session.sessionId]);

  if (!ready || !currentVideo || !session.isActive) {
    if (!ready) {
      return (
        <View style={[styles.container, { alignItems: "center" }]}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      );
    }
    return (
      <View style={[styles.container, { alignItems: "center" }]}>
        <Text style={styles.endText}>Session Complete</Text>
      </View>
    );
  }

  const progress = Math.min(elapsed / sessionTotalSeconds, 1);
  const remaining = Math.max(sessionTotalSeconds - elapsed, 0);
  const isOvertime = elapsed > sessionTotalSeconds;

  const thumbnailUrl =
    currentVideo.customThumbnailUrl ||
    currentVideo.thumbnailUrl ||
    `https://img.youtube.com/vi/${currentVideo.youtubeId}/hqdefault.jpg`;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.centeredContent}>
      <View style={styles.playerArea}>
        {!isCasting && (
          <YoutubePlayer
            height={playerHeight}
            width={screenWidth}
            play={playing}
            videoId={currentVideo.youtubeId}
            onChangeState={handleStateChange}
            onError={handlePlayerError}
            initialPlayerParams={{
              modestbranding: true,
              rel: false,
              preventFullScreen: false,
              controls: true,
            }}
            webViewStyle={{ opacity: 0.99 }}
            webViewProps={{
              allowsInlineMediaPlayback: true,
              mediaPlaybackRequiresUserAction: false,
              allowsFullscreenVideo: true,
              javaScriptEnabled: true,
              domStorageEnabled: true,
            }}
          />
        )}

        {isCasting && (
          <View style={[styles.castingArea, { height: playerHeight }]}>
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.castThumbnail}
              resizeMode="cover"
            />
            <View style={styles.castOverlay}>
              <Feather name="cast" size={40} color="#2dd4a8" />
              <Text style={styles.castDeviceName}>
                Casting to {deviceName || "Chromecast"}
              </Text>
              <Text style={styles.castVideoTitle} numberOfLines={2}>
                {currentVideo.title}
              </Text>

              <View style={styles.castControls}>
                <TouchableOpacity
                  onPress={handleCastPlayPause}
                  style={styles.castControlBtn}
                >
                  <Feather
                    name={playing ? "pause" : "play"}
                    size={28}
                    color={colors.white}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.controlBar}>
        <TouchableOpacity
          onPress={handleEndPress}
          style={styles.controlBtn}
          testID="button-end"
        >
          <Feather name="x" size={20} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.videoIndexBadge}>
          <Text style={styles.videoIndexText}>
            {session.currentIndex + 1}/{session.playlist.length}
          </Text>
        </View>

        <View style={styles.timeInfo}>
          <Text
            style={[
              styles.timeText,
              isOvertime && styles.timeTextOvertime,
            ]}
          >
            {isOvertime ? "+" : ""}
            {formatTime(isOvertime ? elapsed - sessionTotalSeconds : remaining)}{" "}
            {isOvertime ? "over" : "left"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipBtn}
          testID="button-skip"
        >
          <Feather name="skip-forward" size={20} color={colors.white} />
        </TouchableOpacity>

        {isAvailable && NativeCastButton && (
          <NativeCastButton
            style={{ width: 32, height: 32 }}
            tintColor={colors.white}
          />
        )}

        {isAvailable && !NativeCastButton && (
          <TouchableOpacity
            onPress={requestSession}
            style={styles.controlBtn}
          >
            <Feather name="cast" size={20} color={isCasting ? "#2dd4a8" : colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: isOvertime ? colors.warning : colors.primary,
            },
          ]}
        />
      </View>

      <View style={styles.infoBar}>
        <Text style={styles.nowPlaying} numberOfLines={2}>
          {currentVideo.title}
        </Text>
        <View style={styles.stimRow}>
          <Text style={styles.stimLabel}>Energy</Text>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.stimDot,
                {
                  backgroundColor:
                    i <= currentVideo.stimulationLevel
                      ? colors.stimulation[currentVideo.stimulationLevel] ||
                        colors.textTertiary
                      : colors.border,
                },
              ]}
            />
          ))}
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: "center",
  },
  centeredContent: {},
  endText: {
    color: colors.white,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginTop: 100,
  },
  playerArea: {
    backgroundColor: colors.black,
    justifyContent: "center",
  },
  castingArea: {
    backgroundColor: "#0f1923",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  castThumbnail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3,
  },
  castOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.xl,
  },
  castDeviceName: {
    color: "#2dd4a8",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  castVideoTitle: {
    color: colors.white,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 4,
  },
  castControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: 16,
  },
  castControlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndexBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  videoIndexText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  timeInfo: {
    flex: 1,
  },
  timeText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  timeTextOvertime: {
    color: colors.warning,
  },
  skipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressBar: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  infoBar: {
    backgroundColor: "#1a1a2e",
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  nowPlaying: {
    color: colors.white,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  stimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stimLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginRight: 4,
  },
  stimDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
