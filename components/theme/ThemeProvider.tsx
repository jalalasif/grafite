"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { THEMES, DEFAULT_THEME_ID } from "@/themes/registry";
import { THEME_STORAGE_KEY, MODE_STORAGE_KEY } from "@/themes/tokens";
import { type ModeName } from "@/themes/types";

/**
 * Runtime theme/mode state (Amendment 1). The FOUC script in <head> has already
 * stamped `data-theme`/`data-mode` before paint; this provider reads that as the
 * source of truth on mount, then persists and re-applies on change. Switching is
 * just flipping the two attributes — the CSS rules (themes/tokens) do the rest.
 */
interface ThemeContextValue {
  themeId: string;
  mode: ModeName;
  setThemeId: (id: string) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function apply(themeId: string, mode: ModeName): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-mode", mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);
  const [mode, setMode] = useState<ModeName>("light");

  useEffect(() => {
    const root = document.documentElement;
    const t = root.getAttribute("data-theme") ?? DEFAULT_THEME_ID;
    const m = root.getAttribute("data-mode");
    setThemeIdState(THEMES[t] ? t : DEFAULT_THEME_ID);
    setMode(m === "dark" ? "dark" : "light");
  }, []);

  const setThemeId = useCallback(
    (id: string) => {
      const next = THEMES[id] ? id : DEFAULT_THEME_ID;
      setThemeIdState(next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      apply(next, mode);
    },
    [mode],
  );

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ModeName = prev === "light" ? "dark" : "light";
      localStorage.setItem(MODE_STORAGE_KEY, next);
      apply(themeId, next);
      return next;
    });
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, mode, setThemeId, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
