import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  const cases: [string, string][] = [
    ["Hello World", "hello-world"],
    ["  spaced   out  ", "spaced-out"],
    ["Trailing and leading  ", "trailing-and-leading"],
    ["-hi-", "hi"],
    ["UPPER case", "upper-case"],
    ["Café Réel", "cafe-reel"],
    ["naïve café", "naive-cafe"],
    ["Crème brûlée", "creme-brulee"],
    ["foo.bar", "foobar"], // '.' is not a space → stripped, not turned into '-'
    ["hello, world", "hello-world"],
    ["a - b", "a-b"],
    ["a---b", "a-b"], // collapse repeats
    ["Reading Calvino at Night", "reading-calvino-at-night"],
    ["", "untitled"],
    ["!!!", "untitled"],
    ["   ", "untitled"],
    ["你好", "untitled"], // non-latin dropped → empty → untitled
    ["📚 books", "books"],
    ["2026-07-15", "2026-07-15"],
  ];

  for (const [input, expected] of cases) {
    it(`slugify(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
      expect(slugify(input)).toBe(expected);
    });
  }

  it("truncates to 80 chars and trims a trailing dash left by truncation", () => {
    const long = "word ".repeat(40); // 200 chars of "word word word ..."
    const out = slugify(long);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.startsWith("-")).toBe(false);
    expect(out.endsWith("-")).toBe(false);
  });

  it("never turns a truncation boundary into a trailing dash", () => {
    // 'a' x79 then space then more — cut at 80 could land on the '-'
    const input = "a".repeat(79) + " bcdef";
    const out = slugify(input);
    expect(out.endsWith("-")).toBe(false);
    expect(out.length).toBeLessThanOrEqual(80);
  });

  // §II.10 property: output matches /^[a-z0-9-]*$/ and never starts/ends with '-'
  it("property: output is slug-shaped and never edge-dashed", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = slugify(s);
        expect(out).toMatch(/^[a-z0-9-]*$/);
        expect(out.startsWith("-")).toBe(false);
        expect(out.endsWith("-")).toBe(false);
      }),
    );
  });
});

describe("uniqueSlug", () => {
  const existsIn =
    (taken: Set<string>) =>
    (slug: string): Promise<boolean> =>
      Promise.resolve(taken.has(slug));

  it("returns the base when it is free", async () => {
    expect(await uniqueSlug("calvino", existsIn(new Set()))).toBe("calvino");
  });

  it("appends -2 on first collision", async () => {
    expect(await uniqueSlug("calvino", existsIn(new Set(["calvino"])))).toBe(
      "calvino-2",
    );
  });

  it("walks up the suffix until free", async () => {
    const taken = new Set(["calvino", "calvino-2", "calvino-3"]);
    expect(await uniqueSlug("calvino", existsIn(taken))).toBe("calvino-4");
  });

  it("counts calls: probes base, then -2, then -3", async () => {
    const seen: string[] = [];
    const exists = (slug: string) => {
      seen.push(slug);
      return Promise.resolve(slug === "n" || slug === "n-2");
    };
    expect(await uniqueSlug("n", exists)).toBe("n-3");
    expect(seen).toEqual(["n", "n-2", "n-3"]);
  });
});
