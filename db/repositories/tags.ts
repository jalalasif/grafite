import { eq, and, or, asc, sql } from "drizzle-orm";
import { tags, noteTags } from "../schema";
import { type Db } from "../client";
import { type Tag } from "./types";
import { expandTagAncestors } from "@/lib/tags";

/**
 * Tags data access (§II.2, §II.7). The hierarchy is materialised: a nested path
 * becomes one parent-chained row per segment, and a note attaches to the LEAF
 * only (ancestor/descendant rollup happens at query time — never denormalised).
 *
 * Descendant rollup uses `left(name, n)` prefix matching over the materialised
 * full-path names rather than a parent_id recursive CTE. That is equivalent
 * given materialised names, avoids a raw CTE's driver-specific result shape, and
 * is `_`/`%` safe (unlike LIKE). Recorded in conventions.md.
 */

const cols = {
  id: tags.id,
  name: tags.name,
  parentId: tags.parentId,
  createdAt: tags.createdAt,
};

async function findByName(db: Db, name: string): Promise<Tag | null> {
  const [row] = await db
    .select(cols)
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);
  return row ?? null;
}

export const tagsRepo = {
  findByName,

  /** Ensure `fullPath` and every ancestor exist (parent-chained); return the
   * leaf. Idempotent. */
  async materializePath(db: Db, fullPath: string): Promise<Tag> {
    let parentId: string | null = null;
    let leaf: Tag | null = null;
    for (const name of expandTagAncestors(fullPath)) {
      let tag: Tag | null = await findByName(db, name);
      if (!tag) {
        const inserted: Tag[] = await db
          .insert(tags)
          .values({ name, parentId })
          .returning(cols);
        tag = inserted[0]!;
      }
      parentId = tag.id;
      leaf = tag;
    }
    return leaf!;
  },

  async listAll(db: Db): Promise<Tag[]> {
    return db.select(cols).from(tags).orderBy(asc(tags.name));
  },

  async tagsForNote(db: Db, noteId: string): Promise<Tag[]> {
    return db
      .select(cols)
      .from(tags)
      .innerJoin(noteTags, eq(noteTags.tagId, tags.id))
      .where(eq(noteTags.noteId, noteId))
      .orderBy(asc(tags.name));
  },

  /** Replace a note's leaf-tag set. */
  async setNoteTags(db: Db, noteId: string, tagIds: string[]): Promise<void> {
    await db.delete(noteTags).where(eq(noteTags.noteId, noteId));
    const unique = [...new Set(tagIds)];
    if (unique.length > 0) {
      await db
        .insert(noteTags)
        .values(unique.map((tagId) => ({ noteId, tagId })))
        .onConflictDoNothing();
    }
  },

  /** Distinct note ids tagged with `path` or any descendant path. */
  async noteIdsUnderPath(db: Db, path: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ noteId: noteTags.noteId })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(
        or(
          eq(tags.name, path),
          // prefix match on the full-path name, wildcard-safe
          sql`left(${tags.name}, ${path.length + 1}) = ${path + "/"}`,
        ),
      );
    return rows.map((r) => r.noteId);
  },

  /** Delete tags with no notes and no tagged descendants, repeatedly, so a whole
   * dead ancestor chain collapses. Returns the number removed (§II.7 step 3). */
  async pruneOrphans(db: Db): Promise<number> {
    let total = 0;
    let deleted = 1;
    while (deleted > 0) {
      const removed = await db
        .delete(tags)
        .where(
          and(
            sql`${tags.id} NOT IN (SELECT ${noteTags.tagId} FROM ${noteTags})`,
            sql`${tags.id} NOT IN (SELECT parent_id FROM ${tags} WHERE parent_id IS NOT NULL)`,
          ),
        )
        .returning({ id: tags.id });
      deleted = removed.length;
      total += deleted;
    }
    return total;
  },
};
