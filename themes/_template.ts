import { type Theme } from "./types";

/**
 * THEME TEMPLATE — copy this file to `themes/<your-id>.ts`, fill in the values,
 * then add ONE line to `themes/registry.ts`:
 *
 *     import { myTheme } from "./my-theme";
 *     export const THEMES = { [grafite.id]: grafite, [myTheme.id]: myTheme };
 *
 * That is the whole contract (Amendment 1). The build will FAIL unless:
 *   - both `modes.light` and `modes.dark` are present (the type requires it), and
 *   - every text/bg and accent/bg pair clears WCAG AA 4.5:1 in both modes
 *     (themes/registry.test.ts checks this against lib/contrast).
 *
 * Colours are hex here (this is theme data, not a component — the no-colour-
 * literal ESLint rule only applies to components/** and app/**). Design the dark
 * mode deliberately; do not just invert the light one.
 */
export const template: Theme = {
  id: "template", // unique, kebab-case; used in data-theme and localStorage
  name: "Template", // shown in the theme toggle
  modes: {
    light: {
      bg: "#FFFFFF", // page ground
      surface: "#FFFFFF", // raised inputs / popovers
      text: "#000000", // body ink        (must clear AA on bg)
      textMuted: "#555555", // secondary text
      border: "#DDDDDD", // hairlines
      accent: "#0000EE", // the one signal accent (must clear AA on bg)
      accentSoft: "#EEEEFF", // soft accent tint (no AA requirement)
    },
    dark: {
      bg: "#000000",
      surface: "#111111",
      text: "#FFFFFF", // must clear AA on bg
      textMuted: "#AAAAAA",
      border: "#333333",
      accent: "#88AAFF", // must clear AA on bg — lift it for dark
      accentSoft: "#111827",
    },
  },
  fonts: {
    reading: "Georgia, serif",
    ui: "system-ui, sans-serif",
    mono: "ui-monospace, monospace",
  },
};
