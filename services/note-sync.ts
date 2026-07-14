import { type Db } from "@/db/client";
import { type Note } from "@/db/repositories/types";
import { notesRepo } from "@/db/repositories/notes";
import { tagsRepo } from "@/db/repositories/tags";
import { linksRepo } from "@/db/repositories/links";
import { deriveTitle } from "@/lib/title";
import { slugify, uniqueSlug } from "@/lib/slug";
import { parseTags } from "@/lib/tags";
import { parseWikilinks } from "@/lib/wikilinks";

/**
 * The PATCH cascade (§II.7) — the most complex operation in the app, isolated
 * here and run in a single transaction so a note's derived state (title, tags,
 * links) can never be left half-updated. On create/update it:
 *   1. persists body + re-derived title (slug is frozen after creation),
 *   2. re-parses tags → materialises paths → replaces the note's leaf tags,
 *   3. garbage-collects orphaned tags,
 *   4. re-parses wikilinks → resolves slugs → replaces links/unresolved_links,
 *   5. heals: any note whose broken link targets THIS note's slug is promoted.
 */

// Mirrors lib/markdown's asset detection: an embedded image target, not a note.
const IMAGE_TARGET = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/i;

async function cascade(tx: Db, note: Note): Promise<void> {
  // (2, 3) tags
  const tagPaths = [...new Set(parseTags(note.body).map((t) => t.path))];
  const leafIds: string[] = [];
  for (const path of tagPaths) {
    leafIds.push((await tagsRepo.materializePath(tx, path)).id);
  }
  await tagsRepo.setNoteTags(tx, note.id, leafIds);
  await tagsRepo.pruneOrphans(tx);

  // (4) links: note→note wikilinks (image embeds are assets, not links)
  const targets = [
    ...new Set(
      parseWikilinks(note.body)
        .filter((r) => !(r.isEmbed && IMAGE_TARGET.test(r.target)))
        .map((r) => r.target),
    ),
  ];
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const slug of targets) {
    const target = await notesRepo.findBySlug(tx, slug);
    if (target && target.id !== note.id) resolved.push(target.id);
    else if (!target) unresolved.push(slug);
    // a self-link (target is this note) is dropped
  }
  await linksRepo.replaceForSource(tx, note.id, resolved, unresolved);

  // (5) heal broken links that were waiting for this note's slug
  await linksRepo.heal(tx, note.slug, note.id);
}

export interface CreateNoteInput {
  body: string;
  isDaily?: boolean;
  dailyDate?: string;
}

/** Create a note and run the full cascade in one transaction. */
export async function createNote(
  db: Db,
  input: CreateNoteInput,
): Promise<Note> {
  return db.transaction(async (tx) => {
    const isDaily = input.isDaily ?? false;
    const title = isDaily ? input.dailyDate! : deriveTitle(input.body);
    const slug = isDaily
      ? input.dailyDate!
      : await uniqueSlug(slugify(title), (s) => notesRepo.slugExists(tx, s));
    const note = await notesRepo.create(tx, {
      title,
      slug,
      body: input.body,
      isDaily,
      dailyDate: input.dailyDate ?? null,
    });
    await cascade(tx, note);
    return note;
  });
}

/** Update a note's body, re-derive its title (slug stays frozen), and run the
 * cascade — all in one transaction. Returns null if the note is gone. */
export async function updateNote(
  db: Db,
  noteId: string,
  body: string,
): Promise<Note | null> {
  return db.transaction(async (tx) => {
    const existing = await notesRepo.findById(tx, noteId);
    if (!existing) return null;
    const title = existing.isDaily ? existing.title : deriveTitle(body);
    const updated = await notesRepo.updateContent(tx, noteId, { title, body });
    if (!updated) return null;
    await cascade(tx, updated);
    return updated;
  });
}
