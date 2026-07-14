import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, withRollback, type TestDb } from "@/db/testing";
import { createMemoryBlob } from "@/services/blob";
import {
  importFiles,
  type ImportImage,
  type ImportMarkdownFile,
  type ImportOutcome,
} from "./import";
import { notesRepo } from "@/db/repositories/notes";
import { tagsRepo } from "@/db/repositories/tags";
import { linksRepo } from "@/db/repositories/links";
import { assetsRepo } from "@/db/repositories/assets";

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h.close();
});
const run = <T>(fn: Parameters<typeof withRollback<T>>[1]) =>
  withRollback(h.db, fn);

const file = (path: string, content: string): ImportMarkdownFile => ({
  path,
  content,
});

describe("importFiles", () => {
  it("imports a single root .md file: title is the filename, no tags", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();
      const result = (await importFiles(
        tx,
        blob,
        [file("Reading Calvino.md", "# Ignored H1\n\nsome prose")],
        [],
      )) as ImportOutcome;

      expect(result.noteCount).toBe(1);
      expect(result.createdNoteIds).toHaveLength(1);
      expect(result.tagTree).toEqual([]);

      const note = await notesRepo.findById(tx, result.createdNoteIds[0]!);
      expect(note?.title).toBe("Reading Calvino");
      expect(note?.slug).toBe("reading-calvino");
      expect(await tagsRepo.tagsForNote(tx, note!.id)).toEqual([]);
    });
  });

  it("derives a directory tag from the folder path", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();
      const result = (await importFiles(
        tx,
        blob,
        [file("books/fiction/calvino.md", "notes on Calvino")],
        [],
      )) as ImportOutcome;

      const note = await notesRepo.findById(tx, result.createdNoteIds[0]!);
      expect(note?.title).toBe("calvino");
      const tagNames = (await tagsRepo.tagsForNote(tx, note!.id)).map(
        (t) => t.name,
      );
      expect(tagNames).toEqual(["books/fiction"]);
      expect(result.tagTree).toEqual(["books", "books/fiction"]);
    });
  });

  it("merges frontmatter tags with the directory tag", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();
      const body = "---\ntags: [alpha, Beta]\n---\n\nprose";
      const result = (await importFiles(
        tx,
        blob,
        [file("books/fiction/calvino.md", body)],
        [],
      )) as ImportOutcome;

      const note = await notesRepo.findById(tx, result.createdNoteIds[0]!);
      const tagNames = (await tagsRepo.tagsForNote(tx, note!.id))
        .map((t) => t.name)
        .sort();
      expect(tagNames).toEqual(["alpha", "beta", "books/fiction"]);
      expect(result.tagTree).toEqual([
        "alpha",
        "beta",
        "books",
        "books/fiction",
      ]);
      // frontmatter block stripped from the stored body
      expect(note?.body).toBe("\nprose");
    });
  });

  it("uniquifies colliding slugs without destroying either note", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();
      const result = (await importFiles(
        tx,
        blob,
        [file("a/note.md", "first"), file("b/note.md", "second")],
        [],
      )) as ImportOutcome;

      expect(result.collisions).toEqual([
        { path: "b/note.md", desiredSlug: "note", finalSlug: "note-2" },
      ]);
      expect(result.createdNoteIds).toHaveLength(2);
      const first = await notesRepo.findById(tx, result.createdNoteIds[0]!);
      const second = await notesRepo.findById(tx, result.createdNoteIds[1]!);
      expect(first?.slug).toBe("note");
      expect(second?.slug).toBe("note-2");
      expect((await notesRepo.list(tx)).length).toBe(2);
    });
  });

  it("resolves cross-file wikilinks in a single pass (healing)", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();
      const result = (await importFiles(
        tx,
        blob,
        [
          file("alpha.md", "see [[beta]]"),
          file("beta.md", "back to [[alpha]]"),
        ],
        [],
      )) as ImportOutcome;

      const [alphaId, betaId] = result.createdNoteIds as [string, string];
      expect(
        (await linksRepo.linksFrom(tx, alphaId)).map((l) => l.targetId),
      ).toEqual([betaId]);
      expect(
        (await linksRepo.linksFrom(tx, betaId)).map((l) => l.targetId),
      ).toEqual([alphaId]);
    });
  });

  it("uploads referenced images, rewrites to embeds, and links assets", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const images: ImportImage[] = [
        { path: "shot.png", bytes, mimeType: "image/png" },
      ];
      const files = [
        file(
          "one.md",
          "look ![a screenshot](shot.png) and ![missing](nope.png)",
        ),
        file("two.md", "reuse ![again](./shot.png)"),
      ];
      const result = (await importFiles(
        tx,
        blob,
        files,
        images,
      )) as ImportOutcome;

      // one distinct image uploaded even though two notes reference it
      expect(result.imageCount).toBe(1);

      const [oneId, twoId] = result.createdNoteIds as [string, string];
      const one = await notesRepo.findById(tx, oneId);
      // matched image rewritten to a wiki-embed; unmatched image untouched
      expect(one?.body).toBe("look ![[shot.png]] and ![missing](nope.png)");

      const asset = (await assetsRepo.findByNote(tx, oneId))[0];
      expect(asset?.filename).toBe("shot.png");
      expect(asset?.mimeType).toBe("image/png");
      expect(asset?.sizeBytes).toBe(4);
      expect(await blob.get(asset!.blobUrl)).toEqual(bytes);

      // second note also gets an asset row (shared upload)
      expect(await assetsRepo.findByNote(tx, twoId)).toHaveLength(1);
    });
  });

  it("dryRun computes a preview and writes nothing", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();
      const bytes = new Uint8Array([9]);
      const result = await importFiles(
        tx,
        blob,
        [
          file("x/note.md", "look ![p](pic.png)"),
          file("y/note.md", "duplicate slug"),
        ],
        [{ path: "pic.png", bytes, mimeType: "image/png" }],
        { dryRun: true },
      );

      expect(result.noteCount).toBe(2);
      expect(result.imageCount).toBe(1);
      expect(result.tagTree).toEqual(["x", "y"]);
      expect(result.collisions).toEqual([
        { path: "y/note.md", desiredSlug: "note", finalSlug: "note-2" },
      ]);
      expect("createdNoteIds" in result).toBe(false);

      // nothing persisted
      expect(await notesRepo.list(tx)).toEqual([]);
      expect(await notesRepo.slugExists(tx, "note")).toBe(false);
    });
  });
});
