const tintColorLight = "#1a73e8";

export const colors = {
  primary: "#1a73e8",
  primaryLight: "#4a90d9",
  primaryDark: "#1557b0",
  background: "#ffffff",
  surface: "#f8f9fa",
  surfaceDark: "#1a1a2e",
  backgroundDark: "#0f0f23",
  text: "#1f2937",
  textSecondary: "#6b7280",
  textTertiary: "#9ca3af",
  textDark: "#f1f5f9",
  textSecondaryDark: "#94a3b8",
  border: "#e5e7eb",
  borderDark: "#334155",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  white: "#ffffff",
  black: "#000000",
  stimulation: {
    0: "#9ca3af",
    1: "#22c55e",
    2: "#84cc16",
    3: "#eab308",
    4: "#f97316",
    5: "#ef4444",
  } as Record<number, string>,
  avatars: ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export default {
  light: {
    text: "#1f2937",
    background: "#ffffff",
    tint: tintColorLight,
    tabIconDefault: "#ccc",
    tabIconSelected: tintColorLight,
  },
};
