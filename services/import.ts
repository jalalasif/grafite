import { type Db } from "@/db/client";
import { type BlobGateway, type PutResult } from "@/services/blob";
import { createNote } from "@/services/note-sync";
import { notesRepo } from "@/db/repositories/notes";
import { assetsRepo } from "@/db/repositories/assets";
import { slugify, uniqueSlug } from "@/lib/slug";
import { normaliseTagPath, expandTagAncestors } from "@/lib/tags";
import { parseFrontmatter } from "@/lib/frontmatter";

/**
 * Vault import (§II.6.7). Given already-extracted markdown files and images (the
 * API route unzips; this service is DB/blob-focused), create one note per file,
 * deriving its title from the filename and a tag from its folder path, uploading
 * referenced images and rewriting them to embeds, and preserving cross-file
 * `[[wikilinks]]`.
 *
 * A `dryRun` returns an {@link ImportPreview} — computed counts, the resulting
 * tag tree, and predicted slug collisions — WITHOUT touching the database or the
 * blob store, so the API can show the user what an import would do first.
 */

export interface ImportMarkdownFile {
  path: string; // e.g. 'books/fiction/calvino.md'
  content: string;
}

export interface ImportImage {
  path: string; // e.g. 'shot.png'
  bytes: Uint8Array;
  mimeType: string;
}

export interface ImportCollision {
  path: string;
  desiredSlug: string;
  finalSlug: string;
}

export interface ImportPreview {
  noteCount: number;
  imageCount: number;
  tagTree: string[];
  collisions: ImportCollision[];
}

export interface ImportOutcome extends ImportPreview {
  createdNoteIds: string[];
}

/** Last `/`-separated segment of a path (its own file/dir name). */
function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

/** The folder path before the filename, or "" for a root-level file. */
function directoryOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/** The note title: the filename without its `.md` extension. */
function titleOf(path: string): string {
  return basename(path).replace(/\.md$/i, "");
}

// A markdown image: `![alt](ref)` — the ref may carry a trailing "title", which
// we drop before matching. Distinct from wiki-embeds (`![[…]]`).
const MD_IMAGE = /!\[[^\]]*\]\(([^)]*)\)/g;

/**
 * Rewrite every markdown image whose ref basename matches a supplied image into
 * a `![[filename]]` wiki-embed, returning the new body and the (per-note de-
 * duplicated) list of images it referenced. Unmatched images are left as-is.
 */
function rewriteImages(
  body: string,
  byBasename: Map<string, ImportImage>,
): { body: string; matched: ImportImage[] } {
  const matched: ImportImage[] = [];
  const seen = new Set<string>();
  const rewritten = body.replace(MD_IMAGE, (whole, rawRef: string) => {
    const ref = rawRef.trim().split(/\s+/)[0] ?? "";
    const image = byBasename.get(basename(ref));
    if (!image) return whole;
    const filename = basename(image.path);
    if (!seen.has(image.path)) {
      seen.add(image.path);
      matched.push(image);
    }
    return `![[${filename}]]`;
  });
  return { body: rewritten, matched };
}

interface PlannedNote {
  path: string;
  title: string;
  body: string; // frontmatter stripped, images rewritten to embeds
  extraTags: string[]; // directory tag + frontmatter tags (normalised)
  desiredSlug: string;
  matched: ImportImage[];
}

/** Derive every note's title, body, tags and referenced images up front. Shared
 * by the dry run and the real run so both agree on counts and collisions. */
function planNotes(
  files: ImportMarkdownFile[],
  images: ImportImage[],
): PlannedNote[] {
  const byBasename = new Map<string, ImportImage>();
  for (const image of images) byBasename.set(basename(image.path), image);

  return files.map((f) => {
    const fm = parseFrontmatter(f.content);
    const tags = new Set<string>();
    const dir = normaliseTagPath(directoryOf(f.path));
    if (dir !== "") tags.add(dir);
    for (const tag of fm.tags) {
      const norm = normaliseTagPath(tag);
      if (norm !== "") tags.add(norm);
    }
    const title = titleOf(f.path);
    const { body, matched } = rewriteImages(fm.content, byBasename);
    return {
      path: f.path,
      title,
      body,
      extraTags: [...tags],
      desiredSlug: slugify(title),
      matched,
    };
  });
}

/** Sorted, de-duplicated set of every tag path (ancestors expanded) the import
 * will produce from directory + frontmatter tags. */
function buildTagTree(planned: PlannedNote[]): string[] {
  const all = new Set<string>();
  for (const note of planned) {
    for (const path of note.extraTags) {
      for (const ancestor of expandTagAncestors(path)) all.add(ancestor);
    }
  }
  return [...all].sort();
}

/** Distinct images that at least one note references — uploaded once each. */
function countImages(planned: PlannedNote[]): number {
  const paths = new Set<string>();
  for (const note of planned) {
    for (const image of note.matched) paths.add(image.path);
  }
  return paths.size;
}

export async function importFiles(
  db: Db,
  blob: BlobGateway,
  files: ImportMarkdownFile[],
  images: ImportImage[],
  opts?: { dryRun?: boolean },
): Promise<ImportPreview | ImportOutcome> {
  const planned = planNotes(files, images);
  const tagTree = buildTagTree(planned);
  const imageCount = countImages(planned);
  const preview: ImportPreview = {
    noteCount: planned.length,
    imageCount,
    tagTree,
    collisions: [],
  };

  if (opts?.dryRun === true) {
    // Simulate slug assignment without writing: seed the claimed set from the DB
    // and uniquify against both it and existing rows, exactly as createNote will.
    const claimed = new Set<string>();
    for (const note of planned) {
      const finalSlug = await uniqueSlug(
        note.desiredSlug,
        async (s) => claimed.has(s) || notesRepo.slugExists(db, s),
      );
      claimed.add(finalSlug);
      if (finalSlug !== note.desiredSlug) {
        preview.collisions.push({
          path: note.path,
          desiredSlug: note.desiredSlug,
          finalSlug,
        });
      }
    }
    return preview;
  }

  // Real run. Creating every file in input order is enough to resolve cross-file
  // `[[wikilinks]]`: createNote's cascade HEALS any unresolved link the moment
  // its target slug appears, so a note linking a later note is promoted when that
  // note is created — no separate second pass is needed.
  const createdNoteIds: string[] = [];
  const uploaded = new Map<string, PutResult>(); // image path → blob (deduped)

  for (const note of planned) {
    const created = await createNote(db, {
      body: note.body,
      title: note.title,
      extraTags: note.extraTags,
    });
    createdNoteIds.push(created.id);

    // createNote already uniquified via uniqueSlug; a suffix means a collision.
    if (created.slug !== note.desiredSlug) {
      preview.collisions.push({
        path: note.path,
        desiredSlug: note.desiredSlug,
        finalSlug: created.slug,
      });
    }

    // Assets are linked AFTER the note exists (they need its id). The body was
    // already rewritten to the embed before createNote ran.
    for (const image of note.matched) {
      const filename = basename(image.path);
      let put = uploaded.get(image.path);
      if (!put) {
        put = await blob.put(filename, image.bytes, image.mimeType);
        uploaded.set(image.path, put);
      }
      await assetsRepo.create(db, {
        noteId: created.id,
        blobUrl: put.url,
        pathname: put.pathname,
        filename,
        mimeType: image.mimeType,
        sizeBytes: image.bytes.length,
      });
    }
  }

  return { ...preview, createdNoteIds };
}
