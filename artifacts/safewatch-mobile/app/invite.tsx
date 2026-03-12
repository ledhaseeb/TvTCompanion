import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { colors, spacing, borderRadius } from "@/constants/colors";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<
    "loading" | "valid" | "invalid" | "accepted" | "error"
  >("loading");
  const [inviteInfo, setInviteInfo] = useState<{
    email?: string;
    parentName?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      const res = await apiRequest("GET", `/api/caregivers/invite/${token}`);
      const data = await res.json();
      setInviteInfo(data);
      setStatus("valid");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Invalid or expired invitation";
      setErrorMsg(message);
      setStatus("invalid");
    }
  };

  const handleAccept = async () => {
    if (!user) {
      router.push(`/?redirect=invite&token=${token}`);
      return;
    }

    setIsAccepting(true);
    try {
      await apiRequest("POST", "/api/caregivers/accept", { token });
      setStatus("accepted");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to accept invitation";
      setErrorMsg(message);
      setStatus("error");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleGoToApp = () => {
    router.replace("/(main)/children");
  };

  if (authLoading || status === "loading") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking invitation...</Text>
      </View>
    );
  }

  if (status === "accepted") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.card}>
          <View style={styles.successIcon}>
            <Feather name="check" size={32} color={colors.white} />
          </View>
          <Text style={styles.title}>You're In!</Text>
          <Text style={styles.subtitle}>
            You've been added as a caregiver. You can now launch viewing
            sessions.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGoToApp}
            testID="button-go-to-app"
          >
            <Text style={styles.primaryButtonText}>Start Using SafeWatch</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === "invalid" || status === "error") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.card}>
          <View style={styles.errorIcon}>
            <Feather name="x" size={32} color={colors.white} />
          </View>
          <Text style={styles.title}>
            {status === "invalid" ? "Invalid Invitation" : "Something Went Wrong"}
          </Text>
          <Text style={styles.subtitle}>
            {errorMsg ||
              "This invitation link may have expired or already been used."}
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace("/")}
            testID="button-back-to-login"
          >
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.card}>
        <View style={styles.inviteIcon}>
          <Feather name="user-plus" size={32} color={colors.white} />
        </View>
        <Text style={styles.title}>Caregiver Invitation</Text>
        <Text style={styles.subtitle}>
          {inviteInfo?.parentName
            ? `${inviteInfo.parentName} has invited you to be a caregiver on SafeWatch.`
            : "You've been invited to be a caregiver on SafeWatch."}
        </Text>
        <Text style={styles.description}>
          As a caregiver, you'll be able to launch viewing sessions for children.
        </Text>
        {!user && (
          <Text style={styles.note}>
            You'll need to sign in or create an account first.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.primaryButton, isAccepting && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={isAccepting}
          testID="button-accept-invite"
        >
          {isAccepting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {user ? "Accept Invitation" : "Sign In to Accept"}
            </Text>
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
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  inviteIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: colors.warning,
    textAlign: "center",
    fontStyle: "italic",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
