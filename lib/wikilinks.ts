/**
 * Wikilink parser (§II.5.1). Pure — no framework, no I/O.
 *
 * Grammar (per link): optional `!` (embed), `[[`, content with no `[`/`]`,
 * `]]`. Content splits on the first `|` into target-part + display; the
 * target-part splits on its first `#` into target + heading. Links inside code
 * (via lib/code-scan) and backslash-escaped `[[` are ignored. Positions are
 * byte-accurate: `markdown.slice(start, end) === raw`.
 */

import { maskCode } from "./code-scan";

export interface WikilinkRef {
  raw: string;
  target: string;
  heading?: string;
  display?: string;
  isEmbed: boolean;
  start: number;
  end: number;
}

// content excludes `[` and `]`, so nested brackets make the link fail to match.
const WIKILINK_RE = /(!?)\[\[([^[\]]+)\]\]/g;

export function parseWikilinks(markdown: string): WikilinkRef[] {
  const mask = maskCode(markdown);
  const refs: WikilinkRef[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(markdown)) !== null) {
    const start = m.index;
    const isEmbed = m[1] === "!";
    const bracketPos = start + (isEmbed ? 1 : 0);

    if (mask[bracketPos]) continue; // inside code
    if (bracketPos > 0 && markdown[bracketPos - 1] === "\\") continue; // escaped

    const content = m[2]!;
    const pipeIdx = content.indexOf("|");
    const targetPart = pipeIdx >= 0 ? content.slice(0, pipeIdx) : content;
    const displayRaw = pipeIdx >= 0 ? content.slice(pipeIdx + 1).trim() : "";

    const hashIdx = targetPart.indexOf("#");
    const target = (
      hashIdx >= 0 ? targetPart.slice(0, hashIdx) : targetPart
    ).trim();
    const headingRaw = hashIdx >= 0 ? targetPart.slice(hashIdx + 1).trim() : "";

    if (target === "") continue; // empty target → literal text

    const ref: WikilinkRef = {
      raw: m[0],
      target,
      isEmbed,
      start,
      end: start + m[0].length,
    };
    if (headingRaw !== "") ref.heading = headingRaw;
    if (displayRaw !== "") ref.display = displayRaw;
    refs.push(ref);
  }
  return refs;
}

/**
 * Replace every wikilink with the string returned by `fn`, leaving all other
 * text untouched.
 */
export function replaceWikilinks(
  markdown: string,
  fn: (ref: WikilinkRef) => string,
): string {
  const refs = parseWikilinks(markdown);
  let out = "";
  let cursor = 0;
  for (const ref of refs) {
    out += markdown.slice(cursor, ref.start);
    out += fn(ref);
    cursor = ref.end;
  }
  out += markdown.slice(cursor);
  return out;
}
