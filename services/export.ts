import JSZip from "jszip";
import { type Db } from "@/db/client";
import { type BlobGateway } from "@/services/blob";
import { type Note } from "@/db/repositories/types";
import { notesRepo } from "@/db/repositories/notes";
import { tagsRepo } from "@/db/repositories/tags";
import { assetsRepo } from "@/db/repositories/assets";
import { serialiseFrontmatter } from "@/lib/frontmatter";

/**
 * Export (§II.6.8). Two shapes: a single note as an Obsidian-flavoured markdown
 * file, and the whole vault as a zip. Both prepend YAML frontmatter (title, the
 * note's leaf tag names, created/updated ISO timestamps) and keep the body — and
 * therefore its `[[wikilinks]]` — VERBATIM, so a round-trip through Obsidian is
 * lossless. Blob bytes are read through the injected {@link BlobGateway} (never a
 * direct Vercel dependency), so this stays testable against the in-memory store.
 */

/** Serialise one note to frontmatter markdown (body untouched). */
function noteMarkdown(note: Note, tagNames: string[]): string {
  return serialiseFrontmatter(
    {
      title: note.title,
      tags: tagNames,
      created: note.createdAt.toISOString(),
      updated: note.updatedAt.toISOString(),
    },
    note.body,
  );
}

/**
 * Export a single live note as `{ filename, content }`; `null` if the note is
 * missing or soft-deleted. `tags` are the note's leaf tag names.
 */
export async function exportNoteMarkdown(
  db: Db,
  noteId: string,
): Promise<{ filename: string; content: string } | null> {
  const note = await notesRepo.findById(db, noteId);
  if (!note || note.deletedAt !== null) return null;
  const tags = await tagsRepo.tagsForNote(db, note.id);
  return {
    filename: `${note.slug}.md`,
    content: noteMarkdown(
      note,
      tags.map((t) => t.name),
    ),
  };
}

/**
 * Export every live note plus all assets as a zip that opens directly as an
 * Obsidian vault. A note is filed under its FIRST (alphabetical) leaf tag path
 * (`tagsForNote` returns them name-sorted); an untagged note sits at the root.
 * Every asset is placed at `assets/<filename>`, bytes fetched via the gateway.
 */
export async function exportVault(
  db: Db,
  blob: BlobGateway,
): Promise<Uint8Array> {
  const zip = new JSZip();

  const notes = await notesRepo.list(db);
  for (const note of notes) {
    const tags = await tagsRepo.tagsForNote(db, note.id);
    const content = noteMarkdown(
      note,
      tags.map((t) => t.name),
    );
    const first = tags[0];
    const path = first ? `${first.name}/${note.slug}.md` : `${note.slug}.md`;
    zip.file(path, content);
  }

  const assets = await assetsRepo.listAll(db);
  for (const asset of assets) {
    const bytes = await blob.get(asset.blobUrl);
    zip.file(`assets/${asset.filename}`, bytes);
  }

  return zip.generateAsync({ type: "uint8array" });
}
