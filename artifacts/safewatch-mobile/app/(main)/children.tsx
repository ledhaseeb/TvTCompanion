import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { useAuth } from "@/contexts/AuthContext";
import { colors, spacing, borderRadius } from "@/constants/colors";
import type { Child, TaperMode } from "@/lib/types";
import { TAPER_MODES } from "@/lib/types";

const DARK = {
  bg: "#0f1923",
  card: "#1a2a3a",
  cardSelected: "#1a3a3a",
  border: "#2a3a4a",
  borderSelected: "#2dd4a8",
  accent: "#2dd4a8",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  avatarBg: "#334155",
  avatarSelected: "#1e3a3a",
};

function getAge(birthMonth: number, birthYear: number): number {
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() + 1 < birthMonth) age--;
  return Math.max(0, age);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function StartSessionScreen() {
  const { user, isCaregiver, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [youngChildProtection, setYoungChildProtection] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [taperMode, setTaperMode] = useState<TaperMode>("taper_down");
  const [flatlineLevel, setFlatlineLevel] = useState(3);

  const {
    data: children = [],
    isLoading,
    error,
  } = useQuery<Child[]>({
    queryKey: ["/api/children"],
    enabled: !!user,
  });

  const selectedChildren = useMemo(
    () => children.filter((c) => selectedIds.has(c.id)),
    [children, selectedIds],
  );

  const youngestChild = useMemo(() => {
    if (selectedChildren.length === 0) return null;
    return selectedChildren.reduce((youngest, child) => {
      const childAge = getAge(child.birthMonth, child.birthYear);
      const youngestAge = getAge(youngest.birthMonth, youngest.birthYear);
      return childAge < youngestAge ? child : youngest;
    });
  }, [selectedChildren]);

  const youngestAge = youngestChild
    ? getAge(youngestChild.birthMonth, youngestChild.birthYear)
    : null;

  const toggleChild = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePreviewSession = () => {
    if (selectedIds.size === 0) {
      Alert.alert(
        "Select Children",
        "Please select at least one child to start a session.",
      );
      return;
    }
    const selectedNames = selectedChildren.map((c) => c.name);
    router.push({
      pathname: "/(main)/playlist-preview",
      params: {
        childIds: Array.from(selectedIds).join(","),
        childNames: selectedNames.join(","),
        sessionMinutes: String(sessionMinutes),
        taperMode,
        flatlineLevel: String(flatlineLevel),
        includeWindDown: "1",
        finishMode: "soft",
        youngChildProtection: youngChildProtection ? "1" : "0",
      },
    });
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator
          size="large"
          color={DARK.accent}
          style={styles.loader}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.errorText}>Failed to load children</Text>
          <Text style={styles.errorDetail}>{(error as Error).message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.closeButton}
          testID="button-logout"
        >
          <Feather name="x" size={22} color={DARK.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Start Viewing Session</Text>
        <Text style={styles.subtitle}>
          Select which children will be watching together. This helps us choose
          appropriate content for everyone.
        </Text>

        {children.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={DARK.textMuted} />
            <Text style={styles.emptyText}>No children found</Text>
            <Text style={styles.emptySubtext}>
              Add children from the SafeWatch web dashboard to get started.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.avatarRow}>
              {children.map((child, index) => {
                const isSelected = selectedIds.has(child.id);
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={styles.avatarItem}
                    onPress={() => toggleChild(child.id)}
                    activeOpacity={0.7}
                    testID={`avatar-${child.id}`}
                  >
                    <View
                      style={[
                        styles.avatar,
                        isSelected && styles.avatarSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          isSelected && styles.avatarTextSelected,
                        ]}
                      >
                        {getInitials(child.name)}
                      </Text>
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Feather
                            name="check"
                            size={10}
                            color={DARK.bg}
                          />
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.avatarName,
                        isSelected && styles.avatarNameSelected,
                      ]}
                    >
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedChildren.length > 0 && youngestAge !== null && youngestAge <= 5 && (
              <View style={styles.protectionCard}>
                <View style={styles.protectionLeft}>
                  <View style={styles.protectionIcon}>
                    <Feather name="shield" size={18} color={DARK.accent} />
                  </View>
                  <View style={styles.protectionInfo}>
                    <Text style={styles.protectionTitle}>
                      Young Child Protection
                    </Text>
                    <Text style={styles.protectionDesc}>
                      Restrict content to age {youngestAge} ({youngestChild?.name})
                    </Text>
                  </View>
                </View>
                <Switch
                  value={youngChildProtection}
                  onValueChange={setYoungChildProtection}
                  trackColor={{ false: DARK.border, true: DARK.accent }}
                  thumbColor={DARK.text}
                  testID="switch-young-child"
                />
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Session Length</Text>
                <Text style={styles.minutesValue}>{sessionMinutes} min</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={120}
                step={5}
                value={sessionMinutes}
                onValueChange={setSessionMinutes}
                minimumTrackTintColor={DARK.accent}
                maximumTrackTintColor={DARK.border}
                thumbTintColor={DARK.text}
                testID="slider-session-length"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>10 min</Text>
                <Text style={styles.sliderLabel}>120 min</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Energy Pattern</Text>
              <View style={styles.taperGrid}>
                {TAPER_MODES.map((mode) => {
                  const isActive = taperMode === mode.value;
                  return (
                    <TouchableOpacity
                      key={mode.value}
                      style={[
                        styles.taperCard,
                        isActive && styles.taperCardActive,
                      ]}
                      onPress={() => setTaperMode(mode.value)}
                      activeOpacity={0.7}
                      testID={`taper-${mode.value}`}
                    >
                      <Feather
                        name={mode.icon as any}
                        size={24}
                        color={isActive ? DARK.accent : DARK.textMuted}
                      />
                      <Text
                        style={[
                          styles.taperLabel,
                          isActive && styles.taperLabelActive,
                        ]}
                      >
                        {mode.label}
                      </Text>
                      <Text style={styles.taperDesc}>{mode.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {taperMode === "flatline" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Energy Level</Text>
                <View style={styles.stimRow}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => setFlatlineLevel(level)}
                      style={[
                        styles.stimButton,
                        {
                          backgroundColor:
                            flatlineLevel >= level
                              ? colors.stimulation[flatlineLevel] ||
                                DARK.textMuted
                              : DARK.border,
                        },
                      ]}
                    >
                      <Text style={styles.stimButtonText}>{level}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {children.length > 0 && (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <TouchableOpacity
            style={[
              styles.previewButton,
              selectedIds.size === 0 && styles.previewButtonDisabled,
            ]}
            onPress={handlePreviewSession}
            disabled={selectedIds.size === 0}
            activeOpacity={0.8}
            testID="button-preview-session"
          >
            <Feather name="play" size={18} color={DARK.bg} />
            <Text style={styles.previewButtonText}>
              Preview Session
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSelectedIds(new Set());
            }}
            style={styles.cancelButton}
            testID="button-cancel"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK.bg,
  },
  loader: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
    paddingBottom: 200,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: DARK.text,
    textAlign: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  errorText: {
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
  avatarRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatarItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DARK.avatarBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarSelected: {
    backgroundColor: DARK.avatarSelected,
    borderColor: DARK.accent,
  },
  avatarText: {
    color: DARK.textSecondary,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  avatarTextSelected: {
    color: DARK.accent,
  },
  avatarName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: DARK.textSecondary,
  },
  avatarNameSelected: {
    color: DARK.accent,
  },
  checkBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DARK.accent,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: DARK.bg,
  },
  protectionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: DARK.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  protectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
  },
  protectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(45, 212, 168, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  protectionInfo: {
    flex: 1,
  },
  protectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
  },
  protectionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
    marginTop: 1,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
    marginBottom: spacing.sm,
  },
  minutesValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: DARK.accent,
    marginBottom: spacing.sm,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: DARK.textMuted,
  },
  taperGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  taperCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: DARK.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: DARK.border,
  },
  taperCardActive: {
    borderColor: DARK.accent,
    backgroundColor: "rgba(45, 212, 168, 0.05)",
  },
  taperLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: DARK.text,
  },
  taperLabelActive: {
    color: DARK.accent,
  },
  taperDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
    textAlign: "center",
  },
  stimRow: {
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
  stimButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: DARK.bg,
    borderTopWidth: 1,
    borderTopColor: DARK.border,
  },
  previewButton: {
    backgroundColor: DARK.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  previewButtonDisabled: {
    opacity: 0.3,
  },
  previewButtonText: {
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
    borderColor: DARK.border,
  },
  cancelButtonText: {
    color: DARK.text,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});
