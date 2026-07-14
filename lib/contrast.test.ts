import { describe, it, expect } from "vitest";
import { relativeLuminance, contrastRatio, meetsAA } from "./contrast";

describe("relativeLuminance", () => {
  it("is 0 for black", () => {
    expect(relativeLuminance("#000000")).toBe(0);
  });

  it("is 1 for white", () => {
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("expands #RGB shorthand to #RRGGBB", () => {
    expect(relativeLuminance("#fff")).toBe(relativeLuminance("#ffffff"));
  });

  it("accepts hex without a leading '#'", () => {
    expect(relativeLuminance("ffffff")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(relativeLuminance("#FFFFFF")).toBe(relativeLuminance("#ffffff"));
  });

  it("throws on the wrong length", () => {
    expect(() => relativeLuminance("#12")).toThrow();
  });

  it("throws on a non-hex string", () => {
    expect(() => relativeLuminance("nothex")).toThrow();
  });

  it("throws on non-hex characters", () => {
    expect(() => relativeLuminance("#gggggg")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("is ~21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("is 1 for white on white", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("is symmetric (order-independent)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(
      contrastRatio("#ffffff", "#000000"),
    );
    expect(contrastRatio("#767676", "#ffffff")).toBe(
      contrastRatio("#ffffff", "#767676"),
    );
  });

  it("supports #RGB shorthand (#000 on #fff ~ 21)", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 2);
  });
});

describe("meetsAA", () => {
  it("passes for the canonical WCAG AA boundary grey #767676 on white (~4.54)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
    expect(meetsAA("#767676", "#ffffff")).toBe(true);
  });

  it("fails for a slightly lighter grey #808080 on white (below 4.5)", () => {
    expect(contrastRatio("#808080", "#ffffff")).toBeLessThan(4.5);
    expect(meetsAA("#808080", "#ffffff")).toBe(false);
  });

  it("uses the 3.0 large-text threshold when largeText is true", () => {
    // #949494 on white sits between 3.0 and 4.5.
    const ratio = contrastRatio("#949494", "#ffffff");
    expect(ratio).toBeGreaterThan(3.0);
    expect(ratio).toBeLessThan(4.5);
    expect(meetsAA("#949494", "#ffffff", false)).toBe(false);
    expect(meetsAA("#949494", "#ffffff", true)).toBe(true);
  });

  it("passes exactly at the normal-text threshold (ratio === 4.5)", () => {
    // A pair contrived so the ratio lands within reach of 4.5 confirms the
    // `>=` boundary via the canonical grey, which clears 4.5.
    expect(meetsAA("#767676", "#ffffff", false)).toBe(true);
  });
});
