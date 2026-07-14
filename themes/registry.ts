import { type Theme } from "./types";
import { grafite } from "./grafite";

/**
 * The theme registry (Amendment 1). Adding a theme = one new file in themes/ and
 * ONE line here — nothing else. Everything downstream (token emission, the theme
 * toggle, the interface/contrast tests) reads from THEMES.
 */
export const THEMES: Record<string, Theme> = {
  [grafite.id]: grafite,
};

export const DEFAULT_THEME_ID = grafite.id;

export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID]!;
}

export function allThemes(): Theme[] {
  return Object.values(THEMES);
}
