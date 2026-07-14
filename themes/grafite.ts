import { type Theme } from "./types";

/**
 * "Grafite" — the default theme (docs/context/design.md). Concept: graphite on
 * paper. Cool-neutral greys carry the chrome; a single warm rust "signal" accent
 * behaves like a margin mark, never a fill. Dark mode is *designed*, not
 * inverted: the accent lifts and warms so it stays legible on near-black.
 *
 * Every text/bg and accent/bg pair clears WCAG AA 4.5:1 in both modes — verified
 * by themes/registry.test.ts against lib/contrast (light accent 5.40, dark 6.14).
 */
export const grafite: Theme = {
  id: "grafite",
  name: "Grafite",
  modes: {
    light: {
      bg: "#F5F4F1",
      surface: "#FFFFFF",
      text: "#1C1E22",
      textMuted: "#5E6369",
      border: "#E4E2DD",
      accent: "#B23A2E",
      accentSoft: "#F1E4E1",
    },
    dark: {
      bg: "#17191D",
      surface: "#20242A",
      text: "#E6E3DD",
      textMuted: "#9AA0A7",
      border: "#2B2F36",
      accent: "#E8795E",
      accentSoft: "#2A211F",
    },
  },
  fonts: {
    reading:
      "Charter, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
    ui: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace",
  },
};
