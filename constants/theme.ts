// theme constants matching the desktop client design
// material 3 inspired monochromatic dark theme

import { Platform } from "react-native";

// primary accent is kept minimal - mostly grayscale with white as primary
const tintColorLight = "#111111";
const tintColorDark = "#f5f5f5";

export const Colors = {
  light: {
    text: "#111111",
    background: "#f5f5f5",
    tint: tintColorLight,
    icon: "#707070",
    tabIconDefault: "#bdbdbd",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#f5f5f5",
    background: "#111111",
    tint: tintColorDark,
    icon: "#9e9e9e",
    tabIconDefault: "#666666",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// palette matching desktop main.css dark theme variables
export const Palette = {
  // core backgrounds
  background: "#111111",
  surface: "#181818",
  surfaceVariant: "#212121",
  card: "#181818",

  // overlay and borders
  overlay: "rgba(255,255,255,0.04)",
  border: "#3a3a3a",
  borderVariant: "#2c2c2c",
  divider: "#2c2c2c",

  // text colors
  textPrimary: "#f5f5f5",
  textSecondary: "#e0e0e0",
  textMuted: "#9e9e9e",

  // accent - using white as primary per desktop theme
  primary: "#f5f5f5",
  primaryContainer: "#2c2c2c",
  onPrimary: "#000000",
  onPrimaryContainer: "#f5f5f5",

  // status colors
  caution: "#f5f5f5",
  cautionContainer: "#3a3a3a",
  success: "#4ade80",

  // audio quality colors matching desktop
  qualityHires: "#bdbdbd",
  qualityLossless: "#ffffff",
};

export const Radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
};

// gradients simplified to match desktop solid backgrounds
export const Gradients = {
  screen: ["#111111", "#111111", "#111111"] as const,
  card: ["#181818", "#181818"] as const,
  highlight: ["#f5f5f5", "#e0e0e0"] as const,
};
