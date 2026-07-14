import {
  type Theme,
  type ThemeMode,
  type ThemeFonts,
  type ModeName,
} from "./types";
import { THEMES, DEFAULT_THEME_ID } from "./registry";

/**
 * Token emission (Amendment 1). A mode's tokens become CSS custom properties on
 * `:root`, selected by `data-theme` / `data-mode`. Pure functions — no DOM here;
 * the ThemeProvider applies them. Colours live only in theme data (this is not a
 * component), so the no-colour-literal rule does not apply.
 */

export const THEME_STORAGE_KEY = "grafite.theme";
export const MODE_STORAGE_KEY = "grafite.mode";

export function modeToCssVars(mode: ThemeMode): Record<string, string> {
  return {
    "--color-bg": mode.bg,
    "--color-surface": mode.surface,
    "--color-text": mode.text,
    "--color-text-muted": mode.textMuted,
    "--color-border": mode.border,
    "--color-accent": mode.accent,
    "--color-accent-soft": mode.accentSoft,
  };
}

export function fontsToCssVars(fonts: ThemeFonts): Record<string, string> {
  return {
    "--font-reading": fonts.reading,
    "--font-ui": fonts.ui,
    "--font-mono": fonts.mono,
  };
}

function declarations(theme: Theme, mode: ModeName): string {
  const vars = {
    ...modeToCssVars(theme.modes[mode]),
    ...fontsToCssVars(theme.fonts),
  };
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}

/**
 * Every theme×mode as CSS rules keyed by `data-theme`/`data-mode` on `:root`.
 * Rendered once into the document head; switching theme/mode then only flips the
 * two attributes — no re-injection of styles.
 */
export function themesToCss(themes: Record<string, Theme> = THEMES): string {
  const rules: string[] = [];
  for (const theme of Object.values(themes)) {
    for (const mode of ["light", "dark"] as ModeName[]) {
      rules.push(
        `:root[data-theme="${theme.id}"][data-mode="${mode}"] { ${declarations(theme, mode)} }`,
      );
    }
  }
  return rules.join("\n");
}

/**
 * The FOUC-prevention script (Amendment 1): runs in <head> before first paint,
 * reads the persisted theme/mode (falling back to `prefers-color-scheme` for the
 * mode), and stamps `data-theme`/`data-mode` on <html> so the correct tokens
 * apply immediately.
 */
export function foucInlineScript(
  defaultThemeId: string = DEFAULT_THEME_ID,
): string {
  const themeKey = JSON.stringify(THEME_STORAGE_KEY);
  const modeKey = JSON.stringify(MODE_STORAGE_KEY);
  const def = JSON.stringify(defaultThemeId);
  return `(function(){try{var t=localStorage.getItem(${themeKey})||${def};var m=localStorage.getItem(${modeKey});if(m!=='light'&&m!=='dark'){m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var r=document.documentElement;r.setAttribute('data-theme',t);r.setAttribute('data-mode',m);}catch(e){var r=document.documentElement;r.setAttribute('data-theme',${def});r.setAttribute('data-mode','light');}})();`;
}
