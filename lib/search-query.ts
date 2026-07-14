/**
 * Search query prefix parser (§II.6.3). Pure — no framework, no I/O.
 *
 * Search queries may carry scoping prefixes that must be pulled OUT of the raw
 * string before any SQL is built:
 *  - `tag:books/fiction` — scope to a tag (descendant expansion happens later,
 *    in SQL). The value is normalised with the same rules as inline tags.
 *  - `is:daily` — scope to daily/journal notes.
 * Everything else is free-text search terms. Prefix keywords are matched
 * case-insensitively; the tag value keeps `normaliseTagPath`'s lowercasing.
 */

import { normaliseTagPath } from "./tags";

export interface ParsedSearchQuery {
  text: string; // remaining free-text terms, whitespace-collapsed & trimmed
  tag?: string; // normalised tag path (lowercased), if a tag: token was present
  isDaily: boolean; // true if an is:daily token was present
}

/**
 * Split `input` on whitespace, pull out any `tag:` / `is:daily` scope tokens,
 * and return the leftover terms as collapsed, trimmed free text.
 */
export function parseSearchQuery(input: string): ParsedSearchQuery {
  const textTokens: string[] = [];
  let tag: string | undefined;
  let isDaily = false;

  // filter(Boolean) drops the empty tokens produced by leading/trailing/
  // repeated whitespace (and by an all-whitespace or empty input).
  for (const token of input.split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase();
    if (lower.startsWith("tag:")) {
      const path = normaliseTagPath(token.slice(4));
      // Last tag: token wins — a later scope overrides an earlier one. A bare
      // `tag:` normalises to "" and is dropped without setting a scope.
      if (path) tag = path;
    } else if (lower === "is:daily") {
      isDaily = true;
    } else {
      textTokens.push(token);
    }
  }

  return { text: textTokens.join(" "), tag, isDaily };
}
