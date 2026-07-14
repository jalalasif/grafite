/**
 * Tag parser (§II.5.2). Pure — no framework, no I/O.
 *
 * Inline `#tag`, `#nested/tag`. Case is preserved in `raw` but the stored/
 * matched `path` is lowercased. Tags are not parsed inside code (via
 * lib/code-scan). Two borrowed/opened conventions (conventions.md):
 *  - a tag must contain at least one ASCII letter, so `#404` is not a tag
 *    (Obsidian's rule);
 *  - a tag's leading boundary is start-of-text or whitespace, which cleanly
 *    excludes URL fragments (`…/page#anchor`) and `a#b`.
 */

import { maskCode } from "./code-scan";

export interface TagRef {
  raw: string;
  path: string;
  segments: string[];
  start: number;
  end: number;
}

/** Lowercase, collapse `//`, trim edge slashes, drop a leading `#`. */
export function normaliseTagPath(input: string): string {
  return input
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

/** `a/b/c` → `[a, a/b, a/b/c]`. */
export function expandTagAncestors(path: string): string[] {
  const out: string[] = [];
  let acc = "";
  for (const seg of path.split("/")) {
    acc = acc ? `${acc}/${seg}` : seg;
    out.push(acc);
  }
  return out;
}

// Leading boundary = start or whitespace; body = tag-legal chars.
const TAG_RE = /(?<![^\s])#([A-Za-z0-9_/-]+)/g;

export function parseTags(markdown: string): TagRef[] {
  const mask = maskCode(markdown);
  const refs: TagRef[] = [];
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(markdown)) !== null) {
    const start = m.index;
    if (mask[start]) continue; // inside code
    const body = m[1]!;
    if (!/[A-Za-z]/.test(body)) continue; // must have a letter
    // A body that matched TAG_RE and contains a letter always normalises to a
    // non-empty path (letters survive normalisation), so no empty-path guard.
    const path = normaliseTagPath(body);
    refs.push({
      raw: m[0],
      path,
      segments: path.split("/"),
      start,
      end: start + m[0].length,
    });
  }
  return refs;
}
