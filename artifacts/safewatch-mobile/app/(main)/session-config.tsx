import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { colors, spacing, borderRadius } from "@/constants/colors";
import type { Child, TaperMode } from "@/lib/types";
import { TAPER_MODES } from "@/lib/types";

export default function SessionConfigScreen() {
  const { childIds: childIdsStr, childNames: childNamesStr } =
    useLocalSearchParams<{
      childIds: string;
      childNames: string;
    }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const childIds = childIdsStr?.split(",") ?? [];
  const childNames = childNamesStr?.split(",") ?? [];

  const { data: children = [] } = useQuery<Child[]>({
    queryKey: ["/api/children"],
  });

  const selectedChildren = useMemo(
    () => children.filter((c) => childIds.includes(c.id)),
    [children, childIds],
  );

  const defaultMinutes = useMemo(() => {
    if (selectedChildren.length === 0) return 30;
    return Math.min(...selectedChildren.map((c) => c.entertainmentMinutes));
  }, [selectedChildren]);

  const [sessionMinutes, setSessionMinutes] = useState(defaultMinutes);
  const [taperMode, setTaperMode] = useState<TaperMode>("taper_down");
  const [flatlineLevel, setFlatlineLevel] = useState(3);
  const [includeWindDown, setIncludeWindDown] = useState(true);
  const [finishMode, setFinishMode] = useState<"soft" | "hard">("soft");

  const handleContinue = () => {
    router.push({
      pathname: "/(main)/playlist-preview",
      params: {
        childIds: childIds.join(","),
        childNames: childNames.join(","),
        sessionMinutes: String(sessionMinutes),
        taperMode,
        flatlineLevel: String(flatlineLevel),
        includeWindDown: includeWindDown ? "1" : "0",
        finishMode,
      },
    });
  };

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
        <Text style={styles.headerTitle}>Session Setup</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.watchingBadge}>
            <Feather name="users" size={16} color={colors.primary} />
            <Text style={styles.watchingText}>
              {childNames.join(" & ")}
            </Text>
          </View>
          {childIds.length > 1 && (
            <Text style={styles.groupLabel}>Group session</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Length</Text>
          <View style={styles.minutesDisplay}>
            <Text style={styles.minutesValue}>{sessionMinutes}</Text>
            <Text style={styles.minutesUnit}>minutes</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={120}
            step={5}
            value={sessionMinutes}
            onValueChange={setSessionMinutes}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            testID="slider-session-length"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>10m</Text>
            <Text style={styles.sliderLabel}>120m</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Energy Pattern</Text>
          <Text style={styles.sectionSubtitle}>
            How should stimulation change during the session?
          </Text>
          <View style={styles.taperGrid}>
            {TAPER_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.taperOption,
                  taperMode === mode.value && styles.taperOptionSelected,
                ]}
                onPress={() => setTaperMode(mode.value)}
                activeOpacity={0.7}
                testID={`taper-${mode.value}`}
              >
                <Feather
                  name={mode.icon as any}
                  size={22}
                  color={
                    taperMode === mode.value
                      ? colors.primary
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.taperLabel,
                    taperMode === mode.value && styles.taperLabelSelected,
                  ]}
                >
                  {mode.label}
                </Text>
                <Text style={styles.taperDesc}>{mode.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {taperMode === "flatline" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Energy Level</Text>
            <View style={styles.stimDots}>
              {[1, 2, 3, 4, 5].map((level) => (
                <TouchableOpacity
                  key={level}
                  onPress={() => setFlatlineLevel(level)}
                  style={[
                    styles.stimButton,
                    flatlineLevel === level && styles.stimButtonSelected,
                    {
                      backgroundColor:
                        flatlineLevel >= level
                          ? colors.stimulation[flatlineLevel] || colors.textTertiary
                          : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stimButtonText,
                      flatlineLevel === level && styles.stimButtonTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.sectionTitle}>Wind Down Video</Text>
              <Text style={styles.sectionSubtitle}>
                Add a calming video at the end
              </Text>
            </View>
            <Switch
              value={includeWindDown}
              onValueChange={setIncludeWindDown}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={includeWindDown ? colors.primary : colors.white}
              testID="switch-wind-down"
            />
          </View>
        </View>

        <View style={[styles.section, { marginBottom: 120 }]}>
          <Text style={styles.sectionTitle}>When Time is Up</Text>
          <View style={styles.finishRow}>
            <TouchableOpacity
              style={[
                styles.finishOption,
                finishMode === "soft" && styles.finishOptionSelected,
              ]}
              onPress={() => setFinishMode("soft")}
              activeOpacity={0.7}
              testID="finish-soft"
            >
              <Feather
                name="sunset"
                size={20}
                color={
                  finishMode === "soft" ? colors.primary : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.finishLabel,
                  finishMode === "soft" && styles.finishLabelSelected,
                ]}
              >
                Soft End
              </Text>
              <Text style={styles.finishDesc}>
                Finish current video first
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.finishOption,
                finishMode === "hard" && styles.finishOptionSelected,
              ]}
              onPress={() => setFinishMode("hard")}
              activeOpacity={0.7}
              testID="finish-hard"
            >
              <Feather
                name="stop-circle"
                size={20}
                color={
                  finishMode === "hard" ? colors.primary : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.finishLabel,
                  finishMode === "hard" && styles.finishLabelSelected,
                ]}
              >
                Hard Stop
              </Text>
              <Text style={styles.finishDesc}>Stop immediately</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
          testID="button-continue"
        >
          <Text style={styles.continueButtonText}>Preview Playlist</Text>
          <Feather name="arrow-right" size={20} color={colors.white} />
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  watchingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8f0fe",
    borderRadius: borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  watchingText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: colors.primary,
  },
  groupLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  minutesDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 8,
  },
  minutesValue: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: colors.primary,
  },
  minutesUnit: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: colors.textTertiary,
  },
  taperGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  taperOption: {
    width: "48%",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    gap: 4,
  },
  taperOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#f0f5ff",
  },
  taperLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  taperLabelSelected: {
    color: colors.primary,
  },
  taperDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  stimDots: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  stimButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  stimButtonSelected: {
    transform: [{ scale: 1.1 }],
  },
  stimButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: colors.white,
  },
  stimButtonTextSelected: {
    fontSize: 18,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  finishRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  finishOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    gap: 4,
  },
  finishOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#f0f5ff",
  },
  finishLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  finishLabelSelected: {
    color: colors.primary,
  },
  finishDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  continueButton: {
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
  continueButtonText: {
    color: colors.white,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});
