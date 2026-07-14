import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseTags, normaliseTagPath, expandTagAncestors } from "./tags";

describe("normaliseTagPath", () => {
  it("lowercases", () => {
    expect(normaliseTagPath("Books/Fiction")).toBe("books/fiction");
  });
  it("strips a leading #", () => {
    expect(normaliseTagPath("#books")).toBe("books");
  });
  it("collapses consecutive slashes", () => {
    expect(normaliseTagPath("books//fiction")).toBe("books/fiction");
  });
  it("strips leading and trailing slashes", () => {
    expect(normaliseTagPath("/books/fiction/")).toBe("books/fiction");
  });
});

describe("expandTagAncestors", () => {
  it("expands a nested path to its ancestor chain", () => {
    expect(expandTagAncestors("books/fiction/calvino")).toEqual([
      "books",
      "books/fiction",
      "books/fiction/calvino",
    ]);
  });
  it("returns a single-element array for a root tag", () => {
    expect(expandTagAncestors("books")).toEqual(["books"]);
  });
  it("property: length === number of path segments", () => {
    const seg = fc
      .stringMatching(/^[a-z][a-z0-9]*$/)
      .filter((s) => s.length > 0);
    fc.assert(
      fc.property(fc.array(seg, { minLength: 1, maxLength: 6 }), (segs) => {
        const path = segs.join("/");
        expect(expandTagAncestors(path).length).toBe(path.split("/").length);
      }),
    );
  });
});

describe("parseTags", () => {
  const paths = (md: string) => parseTags(md).map((t) => t.path);
  const raws = (md: string) => parseTags(md).map((t) => t.raw);

  it("parses a simple tag", () => {
    expect(paths("a #books note")).toEqual(["books"]);
  });

  it("parses a nested tag", () => {
    expect(paths("read #books/fiction/calvino tonight")).toEqual([
      "books/fiction/calvino",
    ]);
  });

  it("keeps positions byte-accurate (slice === raw)", () => {
    const md = "x #foo and #bar/baz y";
    for (const ref of parseTags(md)) {
      expect(md.slice(ref.start, ref.end)).toBe(ref.raw);
    }
  });

  it("preserves case in raw but lowercases the path", () => {
    const [ref] = parseTags("#Books");
    expect(ref!.raw).toBe("#Books");
    expect(ref!.path).toBe("books");
  });

  it("treats #Books and #books as the same path", () => {
    expect(paths("#Books and #books")).toEqual(["books", "books"]);
  });

  it("does not parse a # followed by whitespace (heading or bare)", () => {
    expect(paths("# Heading\nbody")).toEqual([]);
  });

  it("does not parse a mid-document heading", () => {
    expect(paths("intro\n\n## Section here")).toEqual([]);
  });

  it("does not parse a tag inside inline code", () => {
    expect(paths("run `#notatag` please")).toEqual([]);
  });

  it("does not parse tags inside a fenced code block", () => {
    expect(paths("```\n#nope\n```\n#yes")).toEqual(["yes"]);
  });

  it("does not parse a # inside a URL", () => {
    expect(paths("see https://example.com/page#anchor for more")).toEqual([]);
  });

  it("strips a trailing slash in the path", () => {
    expect(paths("#books/ end")).toEqual(["books"]);
  });

  it("collapses consecutive slashes in the path", () => {
    expect(paths("#books//fiction here")).toEqual(["books/fiction"]);
  });

  it("stops at trailing punctuation", () => {
    expect(raws("done #tag. also #other, ok")).toEqual(["#tag", "#other"]);
  });

  it("parses a tag at end of file", () => {
    expect(paths("ends with #done")).toEqual(["done"]);
  });

  it("parses a tag at the very start of the text", () => {
    expect(paths("#start of note")).toEqual(["start"]);
  });

  it("allows digits, dashes and underscores when a letter is present", () => {
    expect(paths("#project-2026_q3 plan")).toEqual(["project-2026_q3"]);
  });

  it("does not parse a purely numeric tag (Obsidian convention)", () => {
    expect(paths("error #404 occurred")).toEqual([]);
  });

  it("parses multiple tags on a line", () => {
    expect(paths("#a #b #c")).toEqual(["a", "b", "c"]);
  });

  it("exposes segments split on slash", () => {
    const [ref] = parseTags("#a/b/c");
    expect(ref!.segments).toEqual(["a", "b", "c"]);
  });
});
