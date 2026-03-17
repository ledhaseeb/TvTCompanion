import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { apiRequest } from "@/lib/query-client";
import { useSession } from "@/contexts/SessionContext";
import { spacing, borderRadius } from "@/constants/colors";
import type { BehaviorRating } from "@/lib/types";
import { BEHAVIOR_OPTIONS } from "@/lib/types";

const DARK = {
  bg: "#0f1923",
  card: "#1a2a3a",
  cardSelected: "#1a3a3a",
  border: "#2a3a4a",
  borderSelected: "#2dd4a8",
  accent: "#2dd4a8",
  accentDim: "#1a6b5a",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  avatarBg: "#334155",
};

const EMOJI_MAP: Record<string, string> = {
  great: "\uD83D\uDE0A",
  okay: "\uD83D\uDE10",
  upset: "\uD83E\uDD7A",
  tantrum: "\uD83E\uDD2F",
};

function formatClockTime(dateMs: number): string {
  const d = new Date(dateMs);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function SessionFeedbackScreen() {
  const {
    sessionId: paramSessionId,
    childIds: childIdsStr,
    childNames: childNamesStr,
  } = useLocalSearchParams<{
    sessionId: string;
    childIds: string;
    childNames: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetSession, session } = useSession();

  const sessionId = paramSessionId || session.sessionId;
  const childIds = childIdsStr?.split(",") ?? session.childIds;
  const childNames = childNamesStr?.split(",") ?? session.childNames;

  const sessionStartMs = session.startTimeMs || Date.now() - (session.sessionMinutes || 30) * 60 * 1000;
  const sessionDurationMs = (session.sessionMinutes || 30) * 60 * 1000;
  const sessionEndMs = sessionStartMs + sessionDurationMs;

  const [ratings, setRatings] = useState<Record<string, BehaviorRating>>({});
  const [participationPcts, setParticipationPcts] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isGroupSession = childIds.length > 1;

  const allRated = useMemo(
    () => childIds.every((id: string) => ratings[id]),
    [childIds, ratings],
  );

  const handleRate = (childId: string, rating: BehaviorRating) => {
    setRatings((prev) => ({ ...prev, [childId]: rating }));
  };

  const handleParticipationChange = (childId: string, pct: number) => {
    const rounded = Math.round(pct / 5) * 5;
    setParticipationPcts((prev) => ({ ...prev, [childId]: rounded }));
  };

  const getLeaveTime = (pct: number): string => {
    const leaveMs = sessionStartMs + (pct / 100) * sessionDurationMs;
    return formatClockTime(leaveMs);
  };

  const handleSubmit = async () => {
    if (!allRated || !sessionId) return;
    setIsSubmitting(true);
    try {
      const behaviorRatings = Object.entries(ratings).map(
        ([childId, behaviorRating]) => ({
          childId,
          behaviorRating,
        }),
      );

      const pctMap: Record<string, number> = {};
      for (const childId of childIds) {
        pctMap[childId] = participationPcts[childId] ?? 100;
      }

      await apiRequest("POST", `/api/feedback/${sessionId}/complete`, {
        skipped: false,
        behaviorRatings,
        participationPcts: pctMap,
      });
    } catch {}
    resetSession();
    router.replace("/(main)/children");
  };

  const handleSkip = async () => {
    if (sessionId) {
      try {
        await apiRequest("POST", `/api/feedback/${sessionId}/complete`, {
          skipped: true,
        });
      } catch {}
    }
    resetSession();
    router.replace("/(main)/children");
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>How did everyone respond?</Text>
          {isGroupSession && (
            <View style={styles.groupBadge}>
              <Feather name="users" size={14} color={DARK.accent} />
              <Text style={styles.groupBadgeText}>Group</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
            <Feather name="x" size={22} color={DARK.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          Rate each child's behavior and adjust their participation if they walked away early.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {childIds.map((childId: string, index: number) => {
          const pct = participationPcts[childId] ?? 100;
          const name = childNames[index] || `Child ${index + 1}`;
          const initial = name[0].toUpperCase();
          return (
            <View key={childId} style={styles.childSection}>
              <View style={styles.childHeader}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarText}>{initial}</Text>
                </View>
                <Text style={styles.childName}>{name}</Text>
              </View>

              <View style={styles.ratingRow}>
                {BEHAVIOR_OPTIONS.map((option) => {
                  const isSelected = ratings[childId] === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.ratingButton,
                        isSelected && styles.ratingButtonSelected,
                      ]}
                      onPress={() => handleRate(childId, option.value)}
                      activeOpacity={0.7}
                      testID={`rate-${childId}-${option.value}`}
                    >
                      <Text style={styles.ratingEmoji}>
                        {EMOJI_MAP[option.value] || option.label[0]}
                      </Text>
                      <Text
                        style={[
                          styles.ratingLabel,
                          isSelected && styles.ratingLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.participationSection}>
                <View style={styles.participationHeader}>
                  <Text style={styles.participationLabel}>Participation</Text>
                  <Text style={styles.participationValue}>{pct}%</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  value={pct}
                  onValueChange={(val) => handleParticipationChange(childId, val)}
                  minimumTrackTintColor={DARK.accent}
                  maximumTrackTintColor={DARK.border}
                  thumbTintColor={DARK.accent}
                  testID={`slider-${childId}`}
                />
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>
                    {formatClockTime(sessionStartMs)}
                  </Text>
                  <Text style={styles.timeLabel}>
                    {pct < 100
                      ? `Left ~${getLeaveTime(pct)}`
                      : formatClockTime(sessionEndMs)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          testID="button-skip-feedback"
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!allRated || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!allRated || isSubmitting}
          activeOpacity={0.8}
          testID="button-submit-feedback"
        >
          {isSubmitting ? (
            <ActivityIndicator color={DARK.bg} />
          ) : (
            <Text style={styles.submitButtonText}>Done</Text>
          )}
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: DARK.text,
    flex: 1,
  },
  groupBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: DARK.card,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  groupBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: DARK.textSecondary,
  },
  closeButton: {
    padding: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  childSection: {
    marginBottom: spacing.lg,
  },
  childHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  childAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DARK.avatarBg,
    justifyContent: "center",
    alignItems: "center",
  },
  childAvatarText: {
    color: DARK.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  childName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
  },
  ratingRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  ratingButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: DARK.border,
    backgroundColor: DARK.card,
  },
  ratingButtonSelected: {
    borderColor: DARK.accent,
    backgroundColor: "rgba(45, 212, 168, 0.08)",
  },
  ratingEmoji: {
    fontSize: 24,
  },
  ratingLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: DARK.textSecondary,
  },
  ratingLabelSelected: {
    color: DARK.accent,
  },
  participationSection: {
    marginTop: 12,
  },
  participationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  participationLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: DARK.textSecondary,
  },
  participationValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
  },
  slider: {
    width: "100%",
    height: 36,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: DARK.textMuted,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  submitButton: {
    flex: 1,
    backgroundColor: DARK.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: DARK.bg,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    color: DARK.text,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});
