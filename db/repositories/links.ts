import { eq } from "drizzle-orm";
import { links, unresolvedLinks } from "../schema";
import { type Db } from "../client";
import { type Link, type UnresolvedLink } from "./types";

/**
 * Wiki-link data access (§II.6.4 backlinks, §II.7 PATCH cascade). Owns the
 * `links` and `unresolved_links` tables: a note's outbound links are either
 * *resolved* (point at an existing note id) or *unresolved* (point at a slug no
 * note yet has). Returns the {@link Link} / {@link UnresolvedLink} domain types.
 */

const linkCols = { sourceId: links.sourceId, targetId: links.targetId };
const unresolvedCols = {
  sourceId: unresolvedLinks.sourceId,
  targetSlug: unresolvedLinks.targetSlug,
};

export const linksRepo = {
  /**
   * Idempotent replacement of a source note's outbound links (§II.7): clear
   * every existing row for `sourceId`, then insert one resolved row per
   * `resolvedTargetIds` and one unresolved row per `unresolvedSlugs`. Inputs are
   * de-duped so a repeated target/slug cannot violate the composite PK; empty
   * arrays simply leave the source with no links.
   */
  async replaceForSource(
    db: Db,
    sourceId: string,
    resolvedTargetIds: string[],
    unresolvedSlugs: string[],
  ): Promise<void> {
    await db.delete(links).where(eq(links.sourceId, sourceId));
    await db
      .delete(unresolvedLinks)
      .where(eq(unresolvedLinks.sourceId, sourceId));

    const targetIds = [...new Set(resolvedTargetIds)];
    if (targetIds.length > 0) {
      await db
        .insert(links)
        .values(targetIds.map((targetId) => ({ sourceId, targetId })));
    }

    const slugs = [...new Set(unresolvedSlugs)];
    if (slugs.length > 0) {
      await db
        .insert(unresolvedLinks)
        .values(slugs.map((targetSlug) => ({ sourceId, targetSlug })));
    }
  },

  /** Distinct ids of notes that link TO `targetId` — the backlinks panel (§II.6.4). */
  async backlinkSourceIds(db: Db, targetId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ sourceId: links.sourceId })
      .from(links)
      .where(eq(links.targetId, targetId));
    return rows.map((r) => r.sourceId);
  },

  /** Every unresolved row aimed at `slug` — the sources that would heal if a
   * note with this slug appeared. */
  async unresolvedBySlug(db: Db, slug: string): Promise<UnresolvedLink[]> {
    return db
      .select(unresolvedCols)
      .from(unresolvedLinks)
      .where(eq(unresolvedLinks.targetSlug, slug));
  },

  /**
   * Link-healing (§II.7 step 5): a note with `slug` now exists as `targetId`, so
   * promote every unresolved row for that slug into a resolved link and drop the
   * unresolved row. Done in two statements — delete-returning, then a guarded
   * insert (`onConflictDoNothing` absorbs a links PK collision when the source
   * already resolved to `targetId`). Returns the number of rows healed.
   */
  async heal(db: Db, slug: string, targetId: string): Promise<number> {
    const moved = await db
      .delete(unresolvedLinks)
      .where(eq(unresolvedLinks.targetSlug, slug))
      .returning({ sourceId: unresolvedLinks.sourceId });
    if (moved.length > 0) {
      await db
        .insert(links)
        .values(moved.map((r) => ({ sourceId: r.sourceId, targetId })))
        .onConflictDoNothing();
    }
    return moved.length;
  },

  /** A source note's resolved outbound links (read helper). */
  async linksFrom(db: Db, sourceId: string): Promise<Link[]> {
    return db.select(linkCols).from(links).where(eq(links.sourceId, sourceId));
  },

  /** A source note's unresolved outbound links (read helper). */
  async unresolvedFrom(db: Db, sourceId: string): Promise<UnresolvedLink[]> {
    return db
      .select(unresolvedCols)
      .from(unresolvedLinks)
      .where(eq(unresolvedLinks.sourceId, sourceId));
  },
};
