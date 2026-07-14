import { describe, it, expect } from "vitest";
import { parseSearchQuery } from "./search-query";

describe("parseSearchQuery", () => {
  it("returns plain free text with no scopes", () => {
    expect(parseSearchQuery("calvino")).toEqual({
      text: "calvino",
      isDaily: false,
    });
  });

  it("leaves tag undefined when no tag: token is present", () => {
    expect(parseSearchQuery("calvino").tag).toBeUndefined();
  });

  it("extracts a leading tag: scope and keeps the rest as text", () => {
    expect(parseSearchQuery("tag:books/fiction calvino")).toEqual({
      text: "calvino",
      tag: "books/fiction",
      isDaily: false,
    });
  });

  it("normalises the tag value (lowercase, collapse //, trim edge slashes)", () => {
    expect(parseSearchQuery("tag:Books//Fiction/")).toEqual({
      text: "",
      tag: "books/fiction",
      isDaily: false,
    });
  });

  it("extracts an is:daily scope and keeps the rest as text", () => {
    expect(parseSearchQuery("is:daily journal")).toEqual({
      text: "journal",
      isDaily: true,
    });
  });

  it("treats the is:daily keyword case-insensitively", () => {
    expect(parseSearchQuery("IS:DAILY journal")).toEqual({
      text: "journal",
      isDaily: true,
    });
  });

  it("treats the tag: keyword case-insensitively but still lowercases the value", () => {
    expect(parseSearchQuery("TAG:Books calvino")).toEqual({
      text: "calvino",
      tag: "books",
      isDaily: false,
    });
  });

  it("combines tag: and is:daily scopes with multi-word free text", () => {
    expect(parseSearchQuery("tag:books is:daily calvino night")).toEqual({
      text: "calvino night",
      tag: "books",
      isDaily: true,
    });
  });

  it("lets the last tag: token win when several are present", () => {
    expect(parseSearchQuery("tag:books tag:films calvino")).toEqual({
      text: "calvino",
      tag: "films",
      isDaily: false,
    });
  });

  it("ignores a bare tag: with an empty value and drops the token from text", () => {
    expect(parseSearchQuery("tag: calvino")).toEqual({
      text: "calvino",
      isDaily: false,
    });
  });

  it("ignores a bare tag: at end of input", () => {
    expect(parseSearchQuery("calvino tag:")).toEqual({
      text: "calvino",
      isDaily: false,
    });
  });

  it("collapses consecutive whitespace and trims the free text", () => {
    expect(parseSearchQuery("  calvino    night  ")).toEqual({
      text: "calvino night",
      isDaily: false,
    });
  });

  it("returns empty text for an empty query", () => {
    expect(parseSearchQuery("")).toEqual({ text: "", isDaily: false });
  });

  it("returns empty text for a whitespace-only query", () => {
    expect(parseSearchQuery("   ")).toEqual({ text: "", isDaily: false });
  });

  it("extracts scope tokens regardless of position in the string", () => {
    expect(parseSearchQuery("calvino tag:books night is:daily")).toEqual({
      text: "calvino night",
      tag: "books",
      isDaily: true,
    });
  });

  it("keeps an unrecognised is: value as plain text", () => {
    expect(parseSearchQuery("is:weekly note")).toEqual({
      text: "is:weekly note",
      isDaily: false,
    });
  });

  it("does not treat a lookalike prefix like tags: as a scope", () => {
    expect(parseSearchQuery("tags:foo bar")).toEqual({
      text: "tags:foo bar",
      isDaily: false,
    });
  });
});
