import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { notes } from "@/db/schema";
import { type Db } from "@/db/client";
import { type Note } from "@/db/repositories/types";
import { tagsRepo } from "@/db/repositories/tags";
import { parseSearchQuery } from "@/lib/search-query";

/**
 * Full-text search service (§II.6.3). Turns a raw query string into ranked
 * {@link SearchResult}s over the notes' generated `search_vector` (title weight
 * A, body weight B — see db/schema).
 *
 * The raw query is first split by {@link parseSearchQuery} into free `text`
 * plus optional `tag:` / `is:daily` scopes:
 *  - free text drives Postgres FTS: `websearch_to_tsquery` parses the human
 *    grammar (quoted phrases, OR, `-`negation), `ts_rank_cd` ranks, and
 *    `ts_headline` produces a `<mark>`-highlighted snippet;
 *  - scopes narrow the candidate set (a `tag:` path expands to itself plus every
 *    descendant via {@link tagsRepo.noteIdsUnderPath}; `is:daily` keeps journal
 *    notes only);
 *  - a scope with no free text falls back to a newest-first listing (rank 0,
 *    plain body-prefix snippet) so "browse this tag" works;
 *  - an entirely empty query yields nothing.
 *
 * Soft-deleted notes (`deleted_at`) are always excluded.
 */

export interface SearchResult {
  note: Note;
  snippet: string;
  rank: number;
}

const DEFAULT_LIMIT = 50;
const PREFIX_LEN = 160;

// Domain-shaped projection (mirrors notesRepo): the internal search_vector never
// crosses this boundary, and the row shape is exactly the Note type.
const cols = {
  id: notes.id,
  title: notes.title,
  slug: notes.slug,
  body: notes.body,
  isDaily: notes.isDaily,
  dailyDate: notes.dailyDate,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
  deletedAt: notes.deletedAt,
};

export async function search(
  db: Db,
  rawQuery: string,
  opts: { limit?: number } = {},
): Promise<SearchResult[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const { text, tag, isDaily } = parseSearchQuery(rawQuery);

  const hasScope = tag !== undefined || isDaily;
  // Nothing to search on at all.
  if (text === "" && !hasScope) return [];

  // Scope predicates shared by both branches; soft-deleted notes never appear.
  const conditions = [isNull(notes.deletedAt)];

  if (tag !== undefined) {
    const ids = await tagsRepo.noteIdsUnderPath(db, tag);
    // No note carries the tag (or a descendant) → the scope is empty.
    if (ids.length === 0) return [];
    conditions.push(inArray(notes.id, ids));
  }
  if (isDaily) {
    conditions.push(eq(notes.isDaily, true));
  }

  // Scope-only browse: newest first, rank 0, plain body-prefix snippet.
  if (text === "") {
    const rows = await db
      .select(cols)
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.updatedAt))
      .limit(limit);
    return rows.map((note) => ({
      note,
      snippet: note.body.slice(0, PREFIX_LEN),
      rank: 0,
    }));
  }

  // Free-text FTS. The parsed tsquery is reused for the match filter, the rank
  // expression, and the highlighted headline.
  const tsquery = sql`websearch_to_tsquery('english', ${text})`;
  const rank = sql<number>`ts_rank_cd(${notes.searchVector}, ${tsquery})`;
  const snippet = sql<string>`ts_headline('english', ${notes.body}, ${tsquery}, 'StartSel=<mark>,StopSel=</mark>')`;

  const rows = await db
    .select({ ...cols, rank, snippet })
    .from(notes)
    .where(and(...conditions, sql`${notes.searchVector} @@ ${tsquery}`))
    .orderBy(desc(rank), desc(notes.updatedAt))
    .limit(limit);

  return rows.map(({ rank: r, snippet: s, ...note }) => ({
    note,
    snippet: s,
    // ts_rank_cd is a float; some drivers hand it back as a string.
    rank: Number(r),
  }));
}
