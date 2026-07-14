import { describe, it, expect } from "vitest";
import { THEMES, DEFAULT_THEME_ID, getTheme, allThemes } from "./registry";
import { THEME_MODE_KEYS, THEME_FONT_KEYS, type ModeName } from "./types";
import { meetsAA, contrastRatio } from "@/lib/contrast";

const MODES: ModeName[] = ["light", "dark"];

describe("theme registry", () => {
  it("has at least the default theme registered", () => {
    expect(allThemes().length).toBeGreaterThanOrEqual(1);
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });

  it("getTheme returns the theme, or the default for an unknown id", () => {
    expect(getTheme(DEFAULT_THEME_ID).id).toBe(DEFAULT_THEME_ID);
    expect(getTheme("no-such-theme").id).toBe(DEFAULT_THEME_ID);
  });
});

// Amendment 1: every registered theme satisfies the interface in BOTH modes.
describe("every theme satisfies the Theme interface in both modes", () => {
  for (const theme of allThemes()) {
    it(`${theme.id} has id, name and font roles`, () => {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      for (const key of THEME_FONT_KEYS) {
        expect(typeof theme.fonts[key]).toBe("string");
        expect(theme.fonts[key].length).toBeGreaterThan(0);
      }
    });

    for (const mode of MODES) {
      it(`${theme.id} · ${mode} defines every colour token, non-empty`, () => {
        const m = theme.modes[mode];
        for (const key of THEME_MODE_KEYS) {
          expect(typeof m[key]).toBe("string");
          expect(m[key]).toMatch(/^#[0-9a-fA-F]{3,8}$/);
        }
      });
    }
  }
});

// Amendment 1: every theme clears WCAG AA 4.5:1 for text/bg and accent/bg in
// both modes, using the pure lib/contrast.
describe("every theme clears WCAG AA 4.5:1 in both modes", () => {
  for (const theme of allThemes()) {
    for (const mode of MODES) {
      const m = theme.modes[mode];
      it(`${theme.id} · ${mode}: text on bg`, () => {
        expect(
          meetsAA(m.text, m.bg),
          `${theme.id}/${mode} text ${contrastRatio(m.text, m.bg).toFixed(2)}:1`,
        ).toBe(true);
      });
      it(`${theme.id} · ${mode}: accent on bg`, () => {
        expect(
          meetsAA(m.accent, m.bg),
          `${theme.id}/${mode} accent ${contrastRatio(m.accent, m.bg).toFixed(2)}:1`,
        ).toBe(true);
      });
    }
  }
});
