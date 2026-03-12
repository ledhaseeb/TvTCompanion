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
import { apiRequest } from "@/lib/query-client";
import { useSession } from "@/contexts/SessionContext";
import { colors, spacing, borderRadius } from "@/constants/colors";
import type { BehaviorRating } from "@/lib/types";
import { BEHAVIOR_OPTIONS } from "@/lib/types";

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

  const [ratings, setRatings] = useState<Record<string, BehaviorRating>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allRated = useMemo(
    () => childIds.every((id: string) => ratings[id]),
    [childIds, ratings],
  );

  const handleRate = (childId: string, rating: BehaviorRating) => {
    setRatings((prev) => ({ ...prev, [childId]: rating }));
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
      await apiRequest("POST", `/api/feedback/${sessionId}/complete`, {
        skipped: false,
        behaviorRatings,
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
        { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="message-circle" size={28} color={colors.white} />
        </View>
        <Text style={styles.headerTitle}>How did it go?</Text>
        <Text style={styles.headerSubtitle}>
          Rate each child's behavior after the session
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {childIds.map((childId: string, index: number) => (
          <View key={childId} style={styles.childSection}>
            <View style={styles.childHeader}>
              <View
                style={[
                  styles.childAvatar,
                  {
                    backgroundColor:
                      colors.avatars[index % colors.avatars.length],
                  },
                ]}
              >
                <Text style={styles.childAvatarText}>
                  {(childNames[index] || "?")[0].toUpperCase()}
                </Text>
              </View>
              <Text style={styles.childName}>
                {childNames[index] || `Child ${index + 1}`}
              </Text>
            </View>

            <View style={styles.ratingRow}>
              {BEHAVIOR_OPTIONS.map((option) => {
                const isSelected = ratings[childId] === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.ratingButton,
                      isSelected && {
                        borderColor: option.color,
                        backgroundColor: `${option.color}10`,
                      },
                    ]}
                    onPress={() => handleRate(childId, option.value)}
                    activeOpacity={0.7}
                    testID={`rate-${childId}-${option.value}`}
                  >
                    <Feather
                      name={option.icon as any}
                      size={24}
                      color={isSelected ? option.color : colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.ratingLabel,
                        isSelected && { color: option.color },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
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
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          testID="button-skip-feedback"
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
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
  header: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
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
    justifyContent: "center",
    alignItems: "center",
  },
  childAvatarText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  childName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
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
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  ratingLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
