import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Dimensions,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import YoutubePlayer from "react-native-youtube-iframe";
import { useSession } from "@/contexts/SessionContext";
import { useCast } from "@/contexts/CastContext";
import { apiRequest } from "@/lib/query-client";
import { colors, spacing, borderRadius } from "@/constants/colors";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const router = useRouter();
  const {
    session,
    advanceVideo,
    endSession,
    updateWatchTime,
  } = useSession();
  const { isCasting, loadMedia, NativeCastButton } = useCast();

  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchStartRef = useRef(Date.now());
  const totalWatchedRef = useRef(0);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  const { width: screenWidth } = Dimensions.get("window");
  const playerHeight = Math.round((screenWidth * 9) / 16);

  const currentVideo =
    session.playlist.length > 0
      ? session.playlist[session.currentIndex]
      : null;

  const sessionTotalSeconds = session.sessionMinutes * 60;

  useEffect(() => {
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
  }, [session.finishMode, sessionTotalSeconds]);

  useEffect(() => {
    if (showControls) {
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      clearControlsTimer();
      controlsTimer.current = setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 5000);
    }
    return () => clearControlsTimer();
  }, [showControls]);

  useEffect(() => {
    if (currentVideo && isCasting) {
      loadMedia(currentVideo.youtubeId, currentVideo.title);
    }
  }, [currentVideo?.youtubeId, isCasting]);

  const clearControlsTimer = () => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
  };

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  const handleStateChange = useCallback(
    (state: string) => {
      if (state === "ended") {
        recordWatchHistory();
        advanceVideo();
      } else if (state === "paused") {
        setPlaying(false);
      } else if (state === "playing") {
        setPlaying(true);
      }
    },
    [currentVideo, session.sessionId],
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
    await endSession();
    router.replace({
      pathname: "/(main)/session-feedback" as any,
      params: {
        sessionId: session.sessionId || "",
        childIds: session.childIds.join(","),
        childNames: session.childNames.join(","),
      },
    });
  }, [session.sessionId, session.childIds, session.childNames]);

  const handleEndPress = () => {
    Alert.alert("End Session", "Are you sure you want to end this session?", [
      { text: "Cancel", style: "cancel" },
      { text: "End Session", style: "destructive", onPress: handleSessionEnd },
    ]);
  };

  const handleSkip = () => {
    recordWatchHistory();
    advanceVideo();
  };

  if (!currentVideo || !session.isActive) {
    useEffect(() => {
      if (!session.isActive && session.sessionId) {
        router.replace({
          pathname: "/(main)/session-feedback" as any,
          params: {
            sessionId: session.sessionId,
            childIds: session.childIds.join(","),
            childNames: session.childNames.join(","),
          },
        });
      }
    }, [session.isActive]);

    return (
      <View style={styles.container}>
        <Text style={styles.endText}>Session Complete</Text>
      </View>
    );
  }

  const progress = Math.min(elapsed / sessionTotalSeconds, 1);
  const remaining = Math.max(sessionTotalSeconds - elapsed, 0);
  const isOvertime = elapsed > sessionTotalSeconds;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <TouchableOpacity
        activeOpacity={1}
        onPress={toggleControls}
        style={styles.playerArea}
      >
        {!isCasting && (
          <YoutubePlayer
            height={playerHeight}
            width={screenWidth}
            play={playing}
            videoId={currentVideo.youtubeId}
            onChangeState={handleStateChange}
            webViewProps={{
              allowsInlineMediaPlayback: true,
              mediaPlaybackRequiresUserAction: false,
            }}
          />
        )}

        {isCasting && (
          <View style={[styles.castingPlaceholder, { height: playerHeight }]}>
            <Feather name="cast" size={48} color={colors.white} />
            <Text style={styles.castingText}>Casting to TV</Text>
            <Text style={styles.castingTitle}>{currentVideo.title}</Text>
          </View>
        )}

        {showControls && (
          <Animated.View
            style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
          >
            <View style={styles.topControls}>
              <TouchableOpacity
                onPress={handleEndPress}
                style={styles.controlBtn}
                testID="button-end"
              >
                <Feather name="x" size={22} color={colors.white} />
              </TouchableOpacity>

              <View style={styles.videoIndexBadge}>
                <Text style={styles.videoIndexText}>
                  {session.currentIndex + 1}/{session.playlist.length}
                </Text>
              </View>

              {NativeCastButton && (
                <NativeCastButton
                  style={{ width: 40, height: 40 }}
                  tintColor={colors.white}
                />
              )}
            </View>

            <View style={styles.centerControls}>
              <TouchableOpacity
                onPress={() => setPlaying(!playing)}
                style={styles.playPauseBtn}
                testID="button-play-pause"
              >
                <Feather
                  name={playing ? "pause" : "play"}
                  size={36}
                  color={colors.white}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.bottomControls}>
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
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </TouchableOpacity>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  endText: {
    color: colors.white,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginTop: 100,
  },
  playerArea: {
    flex: 1,
    justifyContent: "center",
  },
  castingPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  castingText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  castingTitle: {
    color: colors.white,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: spacing.lg,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndexBadge: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  videoIndexText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  centerControls: {
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    paddingHorizontal: spacing.lg,
  },
  timeInfo: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  timeText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  timeTextOvertime: {
    color: colors.warning,
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
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
