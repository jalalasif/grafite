import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseWikilinks, replaceWikilinks } from "./wikilinks";

const one = (md: string) => {
  const refs = parseWikilinks(md);
  expect(refs).toHaveLength(1);
  return refs[0]!;
};

describe("parseWikilinks", () => {
  it("parses a bare link", () => {
    const ref = one("see [[note-slug]] here");
    expect(ref).toMatchObject({
      target: "note-slug",
      isEmbed: false,
      raw: "[[note-slug]]",
    });
    expect(ref.display).toBeUndefined();
    expect(ref.heading).toBeUndefined();
  });

  it("parses an explicit display", () => {
    const ref = one("[[note-slug|Display text]]");
    expect(ref.target).toBe("note-slug");
    expect(ref.display).toBe("Display text");
  });

  it("parses a heading reference", () => {
    const ref = one("[[note-slug#Some Heading]]");
    expect(ref.target).toBe("note-slug");
    expect(ref.heading).toBe("Some Heading");
    expect(ref.display).toBeUndefined();
  });

  it("parses heading and display together", () => {
    const ref = one("[[note-slug#Heading|Shown]]");
    expect(ref.target).toBe("note-slug");
    expect(ref.heading).toBe("Heading");
    expect(ref.display).toBe("Shown");
  });

  it("parses an image embed", () => {
    const ref = one("![[screenshot.png]]");
    expect(ref.isEmbed).toBe(true);
    expect(ref.target).toBe("screenshot.png");
    expect(ref.raw).toBe("![[screenshot.png]]");
  });

  it("parses a note transclusion embed", () => {
    const ref = one("![[other-note]]");
    expect(ref.isEmbed).toBe(true);
    expect(ref.target).toBe("other-note");
  });

  it("only the first | splits display (| allowed in display)", () => {
    const ref = one("[[slug|a | b | c]]");
    expect(ref.target).toBe("slug");
    expect(ref.display).toBe("a | b | c");
  });

  it("only the first # in the target splits the heading", () => {
    const ref = one("[[slug#h|disp # with hash]]");
    expect(ref.target).toBe("slug");
    expect(ref.heading).toBe("h");
    expect(ref.display).toBe("disp # with hash");
  });

  it("trims whitespace around target and display", () => {
    const ref = one("[[  slug  |  Shown  ]]");
    expect(ref.target).toBe("slug");
    expect(ref.display).toBe("Shown");
  });

  it("keeps byte-accurate positions (slice === raw)", () => {
    const md = "a [[one]] b ![[two.png]] c [[three#h|d]]";
    const refs = parseWikilinks(md);
    expect(refs).toHaveLength(3);
    for (const ref of refs) {
      expect(md.slice(ref.start, ref.end)).toBe(ref.raw);
    }
  });

  it("does not parse an empty target", () => {
    expect(parseWikilinks("[[]] and [[   ]]")).toEqual([]);
  });

  it("does not parse an unclosed [[", () => {
    expect(parseWikilinks("this [[is not closed")).toEqual([]);
  });

  it("does not parse a target with nested brackets", () => {
    expect(parseWikilinks("[[foo[bar]]]")).toEqual([]);
  });

  it("does not parse escaped brackets", () => {
    expect(parseWikilinks("\\[\\[not-a-link\\]\\]")).toEqual([]);
  });

  it("does not parse a [[ escaped with a backslash", () => {
    expect(parseWikilinks("x \\[[nope]]")).toEqual([]);
  });

  it("does not parse links inside inline code", () => {
    expect(parseWikilinks("run `[[nope]]` please")).toEqual([]);
  });

  it("does not parse links inside a fenced code block", () => {
    const refs = parseWikilinks("```\n[[nope]]\n```\n[[yes]]");
    expect(refs.map((r) => r.target)).toEqual(["yes"]);
  });

  it("parses multiple links across a document", () => {
    const refs = parseWikilinks("[[a]] then [[b|B]] then ![[c.png]]");
    expect(refs.map((r) => r.target)).toEqual(["a", "b", "c.png"]);
    expect(refs.map((r) => r.isEmbed)).toEqual([false, false, true]);
  });

  // §II.10 property: positions always satisfy slice(start,end) === raw
  it("property: slice(start,end) === raw for every parsed ref", () => {
    const word = fc.stringMatching(/^[a-z0-9-]{1,8}$/);
    const linkish = fc.oneof(
      word.map((w) => `plain-${w}`),
      word.map((w) => `[[${w}]]`),
      word.map((w) => `![[${w}.png]]`),
      fc.tuple(word, word).map(([a, b]) => `[[${a}|${b}]]`),
      fc.tuple(word, word).map(([a, b]) => `[[${a}#${b}]]`),
    );
    fc.assert(
      fc.property(fc.array(linkish, { maxLength: 12 }), (parts) => {
        const md = parts.join(" ");
        for (const ref of parseWikilinks(md)) {
          expect(md.slice(ref.start, ref.end)).toBe(ref.raw);
        }
      }),
    );
  });
});

describe("replaceWikilinks", () => {
  it("replaces each link via the callback, leaving other text intact", () => {
    const out = replaceWikilinks("go [[a]] and ![[b.png]] now", (ref) =>
      ref.isEmbed ? `<img:${ref.target}>` : `<a:${ref.target}>`,
    );
    expect(out).toBe("go <a:a> and <img:b.png> now");
  });

  it("returns the input unchanged when there are no links", () => {
    expect(replaceWikilinks("plain text only", () => "X")).toBe(
      "plain text only",
    );
  });

  it("preserves text between adjacent links", () => {
    expect(replaceWikilinks("[[a]]-[[b]]", (r) => r.target)).toBe("a-b");
  });
});
