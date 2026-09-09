import { Platform } from "react-native";

/**
 * App color tokens — mirrors the web design tokens in
 * `packages/web/src/web/styles.css` (see design.md).
 * Read them in screens via `useColors()`.
 */
export const Colors = {
  light: {
    background: "#FBFAF9",
    foreground: "#17171A",
    card: "#FFFFFF",
    cardForeground: "#17171A",
    primary: "#C25F3E",
    primaryForeground: "#FFFFFF",
    secondary: "#F1EDE8",
    secondaryForeground: "#17171A",
    muted: "#F1EDE8",
    mutedForeground: "#6F6B65",
    accent: "#EFEAE4",
    accentForeground: "#17171A",
    border: "#E7E3DE",
    bubble: "#EFEAE4",
    code: "#F3EFEA",
    destructive: "#DC2626",
    success: "#16A34A",
    warning: "#D97706",
  },
  dark: {
    background: "#0B0B0C",
    foreground: "#F4F2EF",
    card: "#16161A",
    cardForeground: "#F4F2EF",
    primary: "#D97757",
    primaryForeground: "#14100E",
    secondary: "#1C1C21",
    secondaryForeground: "#F4F2EF",
    muted: "#1C1C21",
    mutedForeground: "#9A968F",
    accent: "#23232A",
    accentForeground: "#F4F2EF",
    border: "#26262C",
    bubble: "#23232A",
    code: "#0D0D10",
    destructive: "#EF4444",
    success: "#22C55E",
    warning: "#F59E0B",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ColorScheme];

/**
 * Platform-appropriate font families. Use for `fontFamily` in styles, or load a
 * custom font with `useFonts` from `expo-font` and reference it here.
 */
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
    sans: "Poppins, system-ui, -apple-system, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', 'Roboto Mono', monospace",
  },
});
