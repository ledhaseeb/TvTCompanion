import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from "@/lib/auth";
import { spacing, borderRadius } from "@/constants/colors";

const DARK = {
  bg: "#0f1923",
  card: "#1a2a3a",
  border: "#2a3a4a",
  accent: "#2dd4a8",
  accentDim: "#1a6b5a",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  error: "#f87171",
  errorBg: "rgba(248,113,113,0.12)",
  errorBorder: "rgba(248,113,113,0.3)",
  google: "#ffffff",
};

export default function LoginScreen() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ redirect?: string; token?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (params.redirect === "invite" && params.token) {
        router.replace(`/invite?token=${params.token}`);
      } else {
        router.replace("/(main)/children");
      }
    }
  }, [isLoading, user, router, params.redirect, params.token]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Feather name="shield" size={32} color={DARK.bg} />
          </View>
          <Text style={styles.logoText}>KidSafeTV</Text>
        </View>
        <ActivityIndicator size="large" color={DARK.accent} />
      </View>
    );
  }

  if (user) return null;

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let idToken: string;
      if (isSignUp) {
        idToken = await signUpWithEmail(email.trim(), password);
      } else {
        idToken = await signInWithEmail(email.trim(), password);
      }
      await login(idToken);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr.code;
      if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password");
      } else if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists");
      } else if (code === "auth/weak-password") {
        setError("Password must be at least 6 characters");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address");
      } else {
        setError(firebaseErr.message || "Authentication failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      await login(idToken);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === "auth/popup-closed-by-user") {
        setError(null);
      } else if (firebaseErr.code === "auth/popup-blocked") {
        setError("Pop-up was blocked. Please allow pop-ups and try again.");
      } else {
        setError(firebaseErr.message || "Google sign-in failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View style={styles.logoIcon}>
            <Feather name="shield" size={36} color={DARK.bg} />
          </View>
          <Text style={styles.appName}>KidSafeTV</Text>
          <Text style={styles.tagline}>Screen time, thoughtfully managed</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formTitle}>
            {isSignUp ? "Create Account" : "Welcome Back"}
          </Text>

          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color={DARK.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Feather
              name="mail"
              size={18}
              color={DARK.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={DARK.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              testID="input-email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Feather
              name="lock"
              size={18}
              color={DARK.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={DARK.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              testID="input-password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={DARK.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleEmailAuth}
            disabled={submitting}
            activeOpacity={0.8}
            testID="button-auth"
          >
            <LinearGradient
              colors={[DARK.accent, "#20b090"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              {submitting ? (
                <ActivityIndicator color={DARK.bg} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? "Create Account" : "Sign In"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, submitting && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={submitting}
            activeOpacity={0.8}
            testID="button-google"
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Companion app for KidSafeTV parents & caregivers
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
    backgroundColor: DARK.bg,
    gap: 24,
  },
  logoContainer: {
    alignItems: "center",
    gap: 12,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: DARK.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: DARK.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: DARK.text,
  },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: DARK.text,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: DARK.textSecondary,
  },
  formSection: {
    gap: 14,
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: DARK.text,
    marginBottom: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: DARK.errorBg,
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: DARK.errorBorder,
  },
  errorText: {
    color: DARK.error,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DARK.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: DARK.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: DARK.text,
    height: "100%",
  },
  eyeButton: {
    padding: 4,
  },
  primaryButton: {
    borderRadius: borderRadius.md,
    marginTop: 4,
    overflow: "hidden",
    shadowColor: DARK.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: borderRadius.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: DARK.bg,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: DARK.border,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: DARK.textMuted,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: DARK.card,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  googleG: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#4285F4",
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: DARK.text,
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchText: {
    color: DARK.accent,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  footerText: {
    textAlign: "center",
    color: DARK.textMuted,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: "auto",
  },
});
