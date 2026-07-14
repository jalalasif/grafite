import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { createTestDb, withRollback, type TestDb } from "@/db/testing";
import { createNote } from "./note-sync";
import { createMemoryBlob } from "./blob";
import { exportNoteMarkdown, exportVault } from "./export";
import { notesRepo } from "@/db/repositories/notes";
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

describe("exportNoteMarkdown", () => {
  it("serialises a note to frontmatter markdown with title and leaf tags", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, {
        body: "# Calvino\n\nabout #books/fiction",
      });
      const result = await exportNoteMarkdown(tx, note.id);
      expect(result).not.toBeNull();
      expect(result!.filename).toBe("calvino.md");
      expect(result!.content.startsWith("---")).toBe(true);
      expect(result!.content).toContain("title: Calvino");
      expect(result!.content).toContain("tags: [books/fiction]");
      // created/updated are ISO strings
      expect(result!.content).toContain(
        `created: ${note.createdAt.toISOString()}`,
      );
    });
  });

  it("returns null for a missing id", async () => {
    await run(async (tx) => {
      expect(
        await exportNoteMarkdown(tx, "00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
    });
  });

  it("returns null for a soft-deleted note", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, { body: "# Gone" });
      await notesRepo.softDelete(tx, note.id);
      expect(await exportNoteMarkdown(tx, note.id)).toBeNull();
    });
  });
});

describe("exportVault", () => {
  it("produces a valid Obsidian vault: tag folders, verbatim wikilinks, and assets", async () => {
    await run(async (tx) => {
      const blob = createMemoryBlob();

      const tagged = await createNote(tx, {
        body: "# Fiction Note\n\nsee [[other note]] about #books/fiction",
      });
      const untagged = await createNote(tx, {
        body: "# Loose Note\n\njust text",
      });

      // Upload an asset via the gateway, then record it against the note.
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 250]);
      const put = await blob.put("uploads/pic.png", bytes, "image/png");
      await assetsRepo.create(tx, {
        noteId: tagged.id,
        blobUrl: put.url,
        pathname: put.pathname,
        filename: "pic.png",
        mimeType: "image/png",
        sizeBytes: bytes.length,
      });

      const zipBytes = await exportVault(tx, blob);
      expect(zipBytes).toBeInstanceOf(Uint8Array);

      const zip = await JSZip.loadAsync(zipBytes);

      // Tagged note filed under its leaf tag path.
      const taggedFile = zip.file(`books/fiction/${tagged.slug}.md`);
      expect(taggedFile).not.toBeNull();
      const taggedContent = await taggedFile!.async("string");
      expect(taggedContent).toContain("---");
      expect(taggedContent).toContain("title: Fiction Note");
      expect(taggedContent).toContain("tags:");
      // Body wikilink preserved verbatim (not transformed).
      expect(taggedContent).toContain("[[other note]]");

      // Untagged note at the vault root.
      expect(zip.file(`${untagged.slug}.md`)).not.toBeNull();
      // ...and NOT under any tag folder.
      expect(zip.file(`books/fiction/${untagged.slug}.md`)).toBeNull();

      // Asset placed under assets/<filename> with the uploaded bytes intact.
      const assetFile = zip.file("assets/pic.png");
      expect(assetFile).not.toBeNull();
      const assetBytes = await assetFile!.async("uint8array");
      expect(assetBytes).toEqual(bytes);
    });
  });
});
