/**
 * Theme model (Amendment 1). A theme carries BOTH modes and a set of font roles.
 * Light and dark are modes *within* a theme — `modes.light` and `modes.dark` are
 * both required, so the type makes a single-mode theme unrepresentable. Pure
 * data: no framework imports (same purity rule as lib/).
 */

/** One mode's colour tokens. Every field is required — a theme cannot omit one. */
export interface ThemeMode {
  /** page ground */
  bg: string;
  /** raised inputs / popovers */
  surface: string;
  /** body ink */
  text: string;
  /** secondary text, timestamps */
  textMuted: string;
  /** hairlines (used sparingly; separation is mostly space) */
  border: string;
  /** the single signal accent — a mark, never a fill (must clear AA on bg) */
  accent: string;
  /** a soft accent tint for hover backgrounds / the margin mark */
  accentSoft: string;
}

/** Runtime list of the required token keys, for the interface-satisfaction test. */
export const THEME_MODE_KEYS: (keyof ThemeMode)[] = [
  "bg",
  "surface",
  "text",
  "textMuted",
  "border",
  "accent",
  "accentSoft",
];

/** Font roles (§II.9): reading serif for prose, sans for chrome, mono for code. */
export interface ThemeFonts {
  reading: string;
  ui: string;
  mono: string;
}

export const THEME_FONT_KEYS: (keyof ThemeFonts)[] = ["reading", "ui", "mono"];

export type ModeName = "light" | "dark";

export interface Theme {
  id: string;
  name: string;
  modes: { light: ThemeMode; dark: ThemeMode };
  fonts: ThemeFonts;
}
