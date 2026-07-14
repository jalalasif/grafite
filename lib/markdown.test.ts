import { describe, it, expect } from "vitest";
import { renderMarkdown, withClasses } from "./markdown";

const notes = (
  entries: Record<string, { title: string; body: string }>,
): Map<string, { title: string; body: string }> =>
  new Map(Object.entries(entries));

describe("renderMarkdown — basic markdown", () => {
  it("renders bold and lists", async () => {
    const html = await renderMarkdown("**bold** text\n\n- one\n- two");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders GFM strikethrough", async () => {
    const html = await renderMarkdown("~~gone~~");
    expect(html).toContain("<del>gone</del>");
  });
});

describe("renderMarkdown — sanitisation (§II.5.5)", () => {
  it("strips a raw <script> tag from the body (no executable element)", async () => {
    const html = await renderMarkdown("hi <script>alert(1)</script> there");
    // The <script> element must be gone. The literal text between the tags may
    // survive as inert plain text (standard markdown) — what matters is that no
    // script element is rendered, so nothing executes.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script");
  });

  it("strips an onerror attribute from raw HTML", async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });
});

describe("renderMarkdown — wikilinks (§II.5.1)", () => {
  const ctx = {
    notes: notes({
      "target-note": { title: "Target Note", body: "target body" },
    }),
  };

  it("renders a resolved wikilink as a link to the note", async () => {
    const html = await renderMarkdown("see [[target-note]] here", ctx);
    expect(html).toContain('href="/notes/target-note"');
    expect(html).toContain("wikilink");
    expect(html).toContain("Target Note");
    expect(html).not.toContain("broken");
  });

  it("uses the display text when given", async () => {
    const html = await renderMarkdown("[[target-note|Shown]]", ctx);
    expect(html).toContain("Shown");
    expect(html).not.toContain("Target Note");
  });

  it("renders an unresolved wikilink with a broken class", async () => {
    const html = await renderMarkdown("[[missing-note]]", ctx);
    expect(html).toContain("broken");
    expect(html).toContain("missing-note");
  });

  it("includes the heading in a heading-reference href", async () => {
    const html = await renderMarkdown("[[target-note#Intro]]", ctx);
    expect(html).toContain("/notes/target-note#");
  });

  it("does not linkify a wikilink inside inline code", async () => {
    const html = await renderMarkdown("`[[target-note]]`", ctx);
    expect(html).toContain("[[target-note]]");
    expect(html).not.toContain('href="/notes/target-note"');
  });

  it("does not linkify a wikilink inside a fenced code block", async () => {
    const html = await renderMarkdown("```\n[[target-note]]\n```", ctx);
    expect(html).not.toContain('href="/notes/target-note"');
  });
});

describe("renderMarkdown — tags (§II.5.2)", () => {
  it("renders a nested tag as a tag link", async () => {
    const html = await renderMarkdown("read #books/fiction tonight");
    expect(html).toContain('href="/tags/books/fiction"');
    expect(html).toContain("tag");
    expect(html).toContain("#books/fiction");
  });

  it("does not render a heading as a tag", async () => {
    const html = await renderMarkdown("# Heading");
    expect(html).toContain("<h1");
    expect(html).not.toContain('href="/tags/');
  });

  it("renders a tag that spans the whole line (start and end boundaries)", async () => {
    const html = await renderMarkdown("#standalone");
    expect(html).toContain('href="/tags/standalone"');
    expect(html).toContain("#standalone");
  });

  it("does not turn a # in a wikilink's display text into a tag", async () => {
    const ctx = { notes: notes({ note: { title: "N", body: "b" } }) };
    const html = await renderMarkdown("[[note|see #x here]]", ctx);
    expect(html).toContain("see #x here");
    expect(html).not.toContain('href="/tags/x"');
  });
});

describe("withClasses (sanitize schema helper)", () => {
  it("appends a className allow-list when none existed", () => {
    expect(withClasses(["href"], ["wikilink"])).toEqual([
      "href",
      ["className", "wikilink"],
    ]);
  });

  it("drops a bare className entry and merges the extras", () => {
    expect(withClasses(["className"], ["tag"])).toEqual([["className", "tag"]]);
  });

  it("preserves already-allowed class values", () => {
    expect(withClasses([["className", "keep"]], ["embed"])).toEqual([
      ["className", "keep", "embed"],
    ]);
  });

  it("keeps non-className array entries untouched", () => {
    expect(withClasses([["rel", "nofollow"]], ["x"])).toEqual([
      ["rel", "nofollow"],
      ["className", "x"],
    ]);
  });

  it("handles an undefined existing list", () => {
    expect(withClasses(undefined, ["y"])).toEqual([["className", "y"]]);
  });
});

describe("renderMarkdown — embeds & transclusion (§II.5.1)", () => {
  it("renders a resolved image embed as an <img>", async () => {
    const ctx = { assets: new Map([["shot.png", "https://blob/shot.png"]]) };
    const html = await renderMarkdown("![[shot.png]]", ctx);
    expect(html).toContain("<img");
    expect(html).toContain("https://blob/shot.png");
  });

  it("renders a missing image embed as a broken embed", async () => {
    const html = await renderMarkdown("![[missing.png]]");
    expect(html).toContain("broken");
    expect(html).toContain("missing.png");
  });

  it("transcludes a note's body one level deep", async () => {
    const ctx = {
      notes: notes({
        child: { title: "Child", body: "CHILD-CONTENT and [[grandchild]]" },
        grandchild: { title: "Grandchild", body: "gc" },
      }),
    };
    const html = await renderMarkdown("before ![[child]] after", ctx);
    expect(html).toContain("CHILD-CONTENT");
    expect(html).toContain("transclusion");
    // the transcluded body's own wikilink still resolves
    expect(html).toContain('href="/notes/grandchild"');
  });

  it("terminates on a transclusion cycle (A embeds B, B embeds A)", async () => {
    // Render note A's body directly. A embeds B (level 1 → transcluded); B
    // embeds A (level 2 → degrades to a link). Must terminate.
    const ctx = {
      notes: notes({
        a: { title: "A", body: "A-TOP ![[b]]" },
        b: { title: "B", body: "B-MID ![[a]]" },
      }),
    };
    const html = await renderMarkdown("A-TOP ![[b]]", ctx);
    expect(html).toContain("A-TOP");
    expect(html).toContain("B-MID");
    // B's embed of A degrades to a plain link (not transcluded again)
    expect(html).toContain('href="/notes/a"');
  });

  it("renders a missing note transclusion as a broken embed", async () => {
    const html = await renderMarkdown("![[no-such-note]]");
    expect(html).toContain("broken");
    expect(html).toContain("no-such-note");
  });
});

describe("renderMarkdown — code highlighting (§II.5.5)", () => {
  it("highlights a fenced code block with shiki", async () => {
    const html = await renderMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain("const");
    expect(html).not.toContain("```");
    expect(html).toContain("<pre");
    // shiki emits token <span>s with inline colour styles (added post-sanitize)
    expect(html).toMatch(/style="[^"]*color/);
  });

  it("renders an unlabelled fenced block without crashing", async () => {
    const html = await renderMarkdown("```\nplain code\n```");
    expect(html).toContain("plain code");
    expect(html).toContain("<pre");
  });
});
