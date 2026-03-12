import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { colors, spacing, borderRadius } from "@/constants/colors";
import type { Child } from "@/lib/types";

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

export default function ChildrenScreen() {
  const { user, isCaregiver, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data: children = [],
    isLoading,
    error,
  } = useQuery<Child[]>({
    queryKey: ["/api/children"],
    enabled: !!user,
  });

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

  const handleStartSession = () => {
    if (selectedIds.size === 0) {
      Alert.alert(
        "Select Children",
        "Please select at least one child to start a session.",
      );
      return;
    }
    const selectedChildren = children.filter((c) => selectedIds.has(c.id));
    const params = {
      childIds: Array.from(selectedIds).join(","),
      childNames: selectedChildren.map((c) => c.name).join(","),
    };
    router.push({
      pathname: "/(main)/session-config",
      params,
    });
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const renderChild = ({
    item,
    index,
  }: {
    item: Child;
    index: number;
  }) => {
    const age = getAge(item.birthMonth, item.birthYear);
    const isSelected = selectedIds.has(item.id);
    const avatarColor = colors.avatars[index % colors.avatars.length];

    return (
      <TouchableOpacity
        style={[styles.childCard, isSelected && styles.childCardSelected]}
        onPress={() => toggleChild(item.id)}
        activeOpacity={0.7}
        testID={`card-child-${item.id}`}
      >
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <Text style={styles.childName}>{item.name}</Text>
        <Text style={styles.childAge}>
          {age} year{age !== 1 ? "s" : ""} old
        </Text>
        <View style={styles.limitRow}>
          <Feather name="clock" size={12} color={colors.textTertiary} />
          <Text style={styles.childTime}>
            {item.entertainmentMinutes}m daily
          </Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Feather name="check" size={14} color={colors.white} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            {isCaregiver ? "Caregiver Session" : "SafeWatch"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {children.length > 0
              ? "Select children for this session"
              : "No children configured yet"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutButton}
          testID="button-logout"
        >
          <Feather name="log-out" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {children.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="users" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No children found</Text>
          <Text style={styles.emptySubtext}>
            Add children from the SafeWatch web dashboard to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={children}
          renderItem={renderChild}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={children.length > 0}
        />
      )}

      {children.length > 0 && (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <TouchableOpacity
            style={[
              styles.startButton,
              selectedIds.size === 0 && styles.startButtonDisabled,
            ]}
            onPress={handleStartSession}
            disabled={selectedIds.size === 0}
            activeOpacity={0.8}
            testID="button-start-session"
          >
            <Feather name="play" size={20} color={colors.white} />
            <Text style={styles.startButtonText}>
              Start Session
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
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
    color: colors.text,
  },
  errorDetail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  row: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  childCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  childCardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#f0f5ff",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  childName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    textAlign: "center",
  },
  childAge: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  childTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: colors.textTertiary,
  },
  checkmark: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
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
  startButton: {
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
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: colors.white,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});
