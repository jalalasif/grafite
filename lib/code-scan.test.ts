import { describe, it, expect } from "vitest";
import { maskCode } from "./code-scan";

/** Helper: the set of substrings the mask marks as "inside code". */
function maskedSpans(text: string): string[] {
  const mask = maskCode(text);
  const spans: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (mask[i]) {
      let j = i;
      while (j < text.length && mask[j]) j++;
      spans.push(text.slice(i, j));
      i = j;
    } else {
      i++;
    }
  }
  return spans;
}

describe("maskCode", () => {
  it("returns an all-false mask for plain text", () => {
    const text = "just some #tag and [[link]] prose";
    expect(maskCode(text)).toEqual(new Array(text.length).fill(false));
  });

  it("masks a fenced code block including the fence lines", () => {
    const text = "before\n```\n#nope [[nope]]\n```\nafter";
    const spans = maskedSpans(text);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toBe("```\n#nope [[nope]]\n```");
  });

  it("masks a tilde-fenced block", () => {
    const text = "a\n~~~\ncode #x\n~~~\nb";
    expect(maskedSpans(text)).toEqual(["~~~\ncode #x\n~~~"]);
  });

  it("does not let a tilde fence close a backtick fence", () => {
    const text = "```\n~~~\nstill code #x\n```\nout";
    // backtick fence opens; ~~~ line stays inside; ``` closes it
    const spans = maskedSpans(text);
    expect(spans[0]).toContain("still code #x");
    expect(spans[0]?.startsWith("```")).toBe(true);
    expect(spans[0]?.endsWith("```")).toBe(true);
  });

  it("masks an inline code span with single backticks", () => {
    const text = "use `#notag` here";
    expect(maskedSpans(text)).toEqual(["`#notag`"]);
  });

  it("masks inline code delimited by multiple backticks", () => {
    const text = "a ``code with ` inside`` b";
    expect(maskedSpans(text)).toEqual(["``code with ` inside``"]);
  });

  it("leaves an unmatched backtick run as literal text", () => {
    const text = "a lone ` backtick #tag";
    expect(maskCode(text).every((m) => m === false)).toBe(true);
  });

  it("handles two inline spans on one line", () => {
    const text = "`a` and `b`";
    expect(maskedSpans(text)).toEqual(["`a`", "`b`"]);
  });

  it("only pairs backtick runs of equal length", () => {
    const text = "``a` b`` c";
    // opening run of 2 must close on a run of 2 → `` ... ``
    expect(maskedSpans(text)).toEqual(["``a` b``"]);
  });

  it("masks an unterminated fence to end of text", () => {
    const text = "x\n```\nnever closed #x";
    expect(maskedSpans(text)).toEqual(["```\nnever closed #x"]);
  });

  it("masks a fence that opens on the last line with no trailing newline", () => {
    expect(maskedSpans("before\n```")).toEqual(["```"]);
  });

  it("does not treat indented `#` inside a fence as a heading escape", () => {
    const text = "```js\nconst x = 1 // #hash\n```";
    expect(maskCode(text).some((m) => m)).toBe(true);
  });
});
