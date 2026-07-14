import { describe, it, expect } from "vitest";
import { deriveTitle } from "./title";

describe("deriveTitle", () => {
  it("uses the first H1 heading text", () => {
    expect(deriveTitle("# My Title\n\nsome body")).toBe("My Title");
  });

  it("picks the H1 even when a paragraph precedes it", () => {
    expect(deriveTitle("intro line\n\n# The Heading\nmore")).toBe(
      "The Heading",
    );
  });

  it("prefers an H1 over an earlier H2", () => {
    expect(deriveTitle("## Section\n# Real Title\ntext")).toBe("Real Title");
  });

  it("uses the first of several H1s", () => {
    expect(deriveTitle("# First\n# Second")).toBe("First");
  });

  it("strips a closed-ATX trailing hash run", () => {
    expect(deriveTitle("# Title ###")).toBe("Title");
  });

  it("strips inline emphasis from the H1 text", () => {
    expect(deriveTitle("# **Bold** and _em_ title")).toBe("Bold and em title");
  });

  it("skips leading YAML frontmatter", () => {
    const body = "---\ntags: [a, b]\ntitle: ignore-me\n---\n# Actual\nbody";
    expect(deriveTitle(body)).toBe("Actual");
  });

  it("skips frontmatter and falls to the first line when no H1", () => {
    const body = "---\ntags: x\n---\nJust a first line\nsecond";
    expect(deriveTitle(body)).toBe("Just a first line");
  });

  it("falls through an image-embed-only first line", () => {
    expect(deriveTitle("![[screenshot.png]]\nThe real first line")).toBe(
      "The real first line",
    );
  });

  it("falls through a markdown-image-only first line", () => {
    expect(deriveTitle("![alt](x.png)\nActual text here")).toBe(
      "Actual text here",
    );
  });

  it("uses the first non-empty line when there is no H1", () => {
    expect(deriveTitle("\n\n  Just a line  \nmore")).toBe("Just a line");
  });

  it("strips markdown from a first-line H2 when no H1 exists", () => {
    expect(deriveTitle("## A Section Only")).toBe("A Section Only");
  });

  it("strips a list marker from the first line", () => {
    expect(deriveTitle("- a todo item\n- another")).toBe("a todo item");
  });

  it("strips a blockquote marker from the first line", () => {
    expect(deriveTitle("> quoted opening\ntext")).toBe("quoted opening");
  });

  it("strips inline code, links and wikilinks from the first line", () => {
    expect(deriveTitle("see `code` and [a link](u) and [[note|Disp]]")).toBe(
      "see code and a link and Disp",
    );
  });

  it("uses a wikilink's target text when it has no display part", () => {
    expect(deriveTitle("go to [[some-note]] now")).toBe("go to some-note now");
  });

  it("ignores headings inside fenced code blocks", () => {
    expect(deriveTitle("```\n# not a title\n```\n# Real One")).toBe("Real One");
  });

  it("returns Untitled for an empty body", () => {
    expect(deriveTitle("")).toBe("Untitled");
  });

  it("returns Untitled for a whitespace-only body", () => {
    expect(deriveTitle("   \n\t\n  ")).toBe("Untitled");
  });

  it("returns Untitled when the only line is an image embed", () => {
    expect(deriveTitle("![[only-image.png]]")).toBe("Untitled");
  });

  it("returns Untitled when the H1 is only emphasis marks", () => {
    expect(deriveTitle("# **__**")).toBe("Untitled");
  });

  it("returns Untitled when the first line strips to nothing", () => {
    expect(deriveTitle("**   **")).toBe("Untitled");
  });

  it("truncates a long first line at a word boundary (<=100 chars)", () => {
    const line = "one two three ".repeat(20).trim(); // > 100 chars, spaced
    const out = deriveTitle(line);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith(" ")).toBe(false);
    expect(line.startsWith(out)).toBe(true);
    // truncation happened on a word boundary → the next char in source is a space
    expect(line[out.length]).toBe(" ");
  });

  it("hard-cuts a first line with no spaces in the first 100 chars", () => {
    const line = "x".repeat(150);
    const out = deriveTitle(line);
    expect(out.length).toBe(100);
  });
});
