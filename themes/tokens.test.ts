import { describe, it, expect } from "vitest";
import {
  modeToCssVars,
  fontsToCssVars,
  themesToCss,
  foucInlineScript,
  THEME_STORAGE_KEY,
  MODE_STORAGE_KEY,
} from "./tokens";
import { grafite } from "./grafite";

describe("modeToCssVars", () => {
  it("emits every colour token as a --color-* custom property", () => {
    const vars = modeToCssVars(grafite.modes.light);
    expect(vars["--color-bg"]).toBe(grafite.modes.light.bg);
    expect(vars["--color-accent"]).toBe(grafite.modes.light.accent);
    expect(vars["--color-accent-soft"]).toBe(grafite.modes.light.accentSoft);
    expect(Object.keys(vars)).toHaveLength(7);
  });
});

describe("fontsToCssVars", () => {
  it("emits the font roles as --font-* properties", () => {
    const vars = fontsToCssVars(grafite.fonts);
    expect(vars["--font-reading"]).toBe(grafite.fonts.reading);
    expect(vars["--font-ui"]).toBe(grafite.fonts.ui);
    expect(vars["--font-mono"]).toBe(grafite.fonts.mono);
  });
});

describe("themesToCss", () => {
  const css = themesToCss();
  it("emits a rule per theme×mode keyed by data-theme/data-mode", () => {
    expect(css).toContain(':root[data-theme="grafite"][data-mode="light"]');
    expect(css).toContain(':root[data-theme="grafite"][data-mode="dark"]');
  });
  it("includes the mode's token values", () => {
    expect(css).toContain(`--color-bg: ${grafite.modes.light.bg};`);
    expect(css).toContain(`--color-bg: ${grafite.modes.dark.bg};`);
    expect(css).toContain("--font-reading:");
  });
});

describe("foucInlineScript", () => {
  const script = foucInlineScript();
  it("reads the persisted theme/mode and stamps the html element", () => {
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain(MODE_STORAGE_KEY);
    expect(script).toContain("data-theme");
    expect(script).toContain("data-mode");
    expect(script).toContain("prefers-color-scheme");
    expect(script).toContain(grafite.id); // default fallback baked in
  });
});
