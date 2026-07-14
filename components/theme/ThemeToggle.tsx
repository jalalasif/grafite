"use client";

import { useTheme } from "./ThemeProvider";

/**
 * The one control that flips light/dark (Amendment 1). Keyboard-focusable with a
 * visible focus ring (§II.9); the label announces the target mode.
 */
export function ThemeToggle() {
  const { mode, toggleMode } = useTheme();
  const next = mode === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      data-testid="theme-toggle"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm outline-none focus-visible:ring-2"
    >
      <span aria-hidden="true">{mode === "light" ? "☾" : "☀"}</span>
    </button>
  );
}
