/**
 * Title derivation (§II.5.3). Pure — no framework, no I/O.
 *
 * Precedence:
 *   1. the first `# H1` heading's text;
 *   2. else the first non-empty, non-image line, markdown-stripped, truncated
 *      to 100 chars at a word boundary;
 *   3. else `"Untitled"`.
 *
 * Leading YAML frontmatter is skipped, and headings inside fenced code blocks
 * are ignored.
 */

const MAX_TITLE = 100;

/** Strip a leading `---` fenced YAML block, if present at the very start. */
function stripLeadingFrontmatter(body: string): string {
  const match = /^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(body);
  return match ? body.slice(match[0].length) : body;
}

/** Remove inline markdown decoration from a single line, leaving its text. */
function stripInline(line: string): string {
  return line
    .replace(/^\s*#{1,6}[ \t]+/, "") // heading marks
    .replace(/^\s*[-*+][ \t]+/, "") // bullet marker
    .replace(/^\s*>[ \t]?/, "") // blockquote marker
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // md image → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // md link → text
    .replace(
      /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g,
      (_m, target: string, display?: string) => display ?? target,
    ) // wikilink → display or target
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .trim();
}

/** Strip a closed-ATX trailing `#` run and inline decoration from H1 text. */
function cleanHeading(text: string): string {
  return stripInline(text.replace(/[ \t]+#+[ \t]*$/, ""));
}

/** Is a line worth being the title? Non-blank and not just an image. */
function isMeaningful(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  if (/^!\[\[[^\]]*\]\]$/.test(t)) return false; // embed-only
  if (/^!\[[^\]]*\]\([^)]*\)$/.test(t)) return false; // md-image-only
  return true;
}

/** Truncate to `max` chars at the last word boundary within the limit. */
function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

export function deriveTitle(body: string): string {
  const content = stripLeadingFrontmatter(body);
  const lines = content.split(/\r?\n/);

  let inFence = false;
  let h1: string | null = null;
  let firstLine: string | null = null;

  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (h1 === null) {
      const m = /^#[ \t]+(.+)$/.exec(line);
      if (m) {
        const cleaned = cleanHeading(m[1]);
        if (cleaned !== "") h1 = cleaned;
      }
    }
    if (firstLine === null && isMeaningful(line)) {
      firstLine = line;
    }
  }

  if (h1 !== null) return h1;
  if (firstLine !== null) {
    const text = truncateAtWord(stripInline(firstLine), MAX_TITLE);
    if (text !== "") return text;
  }
  return "Untitled";
}
