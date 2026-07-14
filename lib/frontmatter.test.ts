import { describe, it, expect } from "vitest";
import { parseFrontmatter, serialiseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("returns empty data/tags and unchanged content when there is no frontmatter", () => {
    const body = "just a plain note\nwith two lines";
    expect(parseFrontmatter(body)).toEqual({
      data: {},
      tags: [],
      content: body,
    });
  });

  it("parses a simple key/value into data and trims the value", () => {
    const fm = parseFrontmatter("---\ntitle:    Spaced   \n---\nbody");
    expect(fm.data).toEqual({ title: "Spaced" });
    expect(fm.tags).toEqual([]);
    expect(fm.content).toBe("body");
  });

  it("treats an unterminated frontmatter block as plain content", () => {
    const body = "---\ntitle: x\nno closing fence here";
    expect(parseFrontmatter(body)).toEqual({
      data: {},
      tags: [],
      content: body,
    });
  });

  it("strips exactly one newline after the closing fence", () => {
    const fm = parseFrontmatter("---\na: b\n---\n\nbody");
    expect(fm.content).toBe("\nbody");
  });

  it("leaves empty content when the closing fence is the last line", () => {
    const fm = parseFrontmatter("---\na: b\n---");
    expect(fm.content).toBe("");
  });

  it("parses an inline flow list of tags", () => {
    const fm = parseFrontmatter("---\ntags: [a, b, c]\n---\nbody");
    expect(fm.tags).toEqual(["a", "b", "c"]);
  });

  it("parses a comma-separated tag string", () => {
    const fm = parseFrontmatter("---\ntags: a, b, c\n---\nbody");
    expect(fm.tags).toEqual(["a", "b", "c"]);
  });

  it("parses a single tag value", () => {
    const fm = parseFrontmatter("---\ntags: solo\n---\nbody");
    expect(fm.tags).toEqual(["solo"]);
  });

  it("parses an indented block list of tags", () => {
    const fm = parseFrontmatter("---\ntags:\n  - a\n  - b\n---\nbody");
    expect(fm.tags).toEqual(["a", "b"]);
    expect(fm.content).toBe("body");
  });

  it("stops the tags block list at the next key and keeps that key in data", () => {
    const fm = parseFrontmatter(
      "---\ntags:\n  - a\ncreated: 2026-01-01\n---\nbody",
    );
    expect(fm.tags).toEqual(["a"]);
    expect(fm.data).toEqual({ created: "2026-01-01" });
  });

  it("does not leak block-list item lines into data", () => {
    const fm = parseFrontmatter("---\ntags:\n  - a\n  - b\n---\nbody");
    expect(fm.data).toEqual({});
  });

  it("de-duplicates tags keeping first-occurrence order", () => {
    const fm = parseFrontmatter("---\ntags: [a, b, a, c, b]\n---\nbody");
    expect(fm.tags).toEqual(["a", "b", "c"]);
  });

  it("drops empty tag entries", () => {
    const fm = parseFrontmatter("---\ntags: a, , b\n---\nbody");
    expect(fm.tags).toEqual(["a", "b"]);
  });

  it("matches the tags key case-insensitively", () => {
    const fm = parseFrontmatter("---\nTags: [x, y]\n---\nbody");
    expect(fm.tags).toEqual(["x", "y"]);
  });

  it("preserves the case of tag values", () => {
    const fm = parseFrontmatter("---\ntags: [Foo, Bar]\n---\nbody");
    expect(fm.tags).toEqual(["Foo", "Bar"]);
  });

  it("keeps non-tags keys case-sensitive in data", () => {
    const fm = parseFrontmatter("---\nTitle: Hello\n---\nbody");
    expect(fm.data).toEqual({ Title: "Hello" });
  });

  it("ignores non key/value lines inside the frontmatter block", () => {
    const fm = parseFrontmatter("---\ntitle: Hi\n\nbare line\n---\nbody");
    expect(fm.data).toEqual({ title: "Hi" });
    expect(fm.tags).toEqual([]);
  });

  it("allows an optional leading BOM before the frontmatter", () => {
    const fm = parseFrontmatter("﻿---\ntags: a\n---\nbody");
    expect(fm.tags).toEqual(["a"]);
    expect(fm.content).toBe("body");
  });

  it("recognises a CRLF-delimited frontmatter block", () => {
    const fm = parseFrontmatter("---\r\ntags: a\r\n---\r\nbody");
    expect(fm.tags).toEqual(["a"]);
    expect(fm.content).toBe("body");
  });
});

describe("serialiseFrontmatter", () => {
  it("serialises all fields in title/tags/created/updated order", () => {
    const out = serialiseFrontmatter(
      {
        title: "My Note",
        tags: ["a", "b"],
        created: "2026-01-01",
        updated: "2026-02-02",
      },
      "the body",
    );
    expect(out).toBe(
      "---\ntitle: My Note\ntags: [a, b]\ncreated: 2026-01-01\nupdated: 2026-02-02\n---\n\nthe body",
    );
  });

  it("omits undefined fields", () => {
    expect(serialiseFrontmatter({ title: "Only" }, "body")).toBe(
      "---\ntitle: Only\n---\n\nbody",
    );
  });

  it("omits the tags line for an empty array", () => {
    expect(serialiseFrontmatter({ title: "T", tags: [] }, "b")).toBe(
      "---\ntitle: T\n---\n\nb",
    );
  });

  it("serialises tags without a title", () => {
    expect(serialiseFrontmatter({ tags: ["a"] }, "b")).toBe(
      "---\ntags: [a]\n---\n\nb",
    );
  });

  it("round-trips tags and title through parse", () => {
    const out = serialiseFrontmatter(
      { title: "Hello", tags: ["x", "y"] },
      "content here",
    );
    const fm = parseFrontmatter(out);
    expect(fm.tags).toEqual(["x", "y"]);
    expect(fm.data.title).toBe("Hello");
    expect(fm.content).toBe("\ncontent here");
  });
});
