import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, withRollback, type TestDb } from "../testing";
import { assets } from "../schema";
import { assetsRepo } from "./assets";
import { notesRepo } from "./notes";

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h.close();
});
const run = <T>(fn: Parameters<typeof withRollback<T>>[1]) =>
  withRollback(h.db, fn);

const MISSING = "00000000-0000-0000-0000-000000000000";

// pglite's now() is transaction-constant, so every row inserted inside a
// rolled-back test shares one createdAt. Stamp distinct times to prove ordering.
const stampCreatedAt = (
  tx: Parameters<Parameters<typeof run>[0]>[0],
  id: string,
  iso: string,
) =>
  tx
    .update(assets)
    .set({ createdAt: new Date(iso) })
    .where(eq(assets.id, id));

describe("assetsRepo", () => {
  it("creates an asset attached to a note and finds it by id", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "Note",
        slug: "note",
        body: "",
      });
      const asset = await assetsRepo.create(tx, {
        noteId: note.id,
        blobUrl: "https://blob/one",
        pathname: "vault/one.png",
        filename: "one.png",
        mimeType: "image/png",
        sizeBytes: 1234,
      });

      expect(asset.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(asset.noteId).toBe(note.id);
      expect(asset.blobUrl).toBe("https://blob/one");
      expect(asset.pathname).toBe("vault/one.png");
      expect(asset.filename).toBe("one.png");
      expect(asset.mimeType).toBe("image/png");
      expect(asset.sizeBytes).toBe(1234);
      expect(asset.createdAt).toBeInstanceOf(Date);

      const found = await assetsRepo.findById(tx, asset.id);
      expect(found?.id).toBe(asset.id);
      expect(found?.noteId).toBe(note.id);
    });
  });

  it("creates an asset with no note (noteId defaults to null when omitted)", async () => {
    await run(async (tx) => {
      const asset = await assetsRepo.create(tx, {
        blobUrl: "https://blob/orphan",
        pathname: "vault/orphan.png",
        filename: "orphan.png",
        mimeType: "image/png",
        sizeBytes: 10,
      });
      expect(asset.noteId).toBeNull();

      const explicitNull = await assetsRepo.create(tx, {
        noteId: null,
        blobUrl: "https://blob/orphan2",
        pathname: "vault/orphan2.png",
        filename: "orphan2.png",
        mimeType: "image/png",
        sizeBytes: 20,
      });
      expect(explicitNull.noteId).toBeNull();
    });
  });

  it("returns null from findById for a missing id", async () => {
    await run(async (tx) => {
      expect(await assetsRepo.findById(tx, MISSING)).toBeNull();
    });
  });

  it("findByNote returns only that note's assets, ordered by createdAt asc", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "Owner",
        slug: "owner",
        body: "",
      });
      const other = await notesRepo.create(tx, {
        title: "Other",
        slug: "other",
        body: "",
      });

      const mk = (n: string, noteId: string) =>
        assetsRepo.create(tx, {
          noteId,
          blobUrl: `https://blob/${n}`,
          pathname: `vault/${n}.png`,
          filename: `${n}.png`,
          mimeType: "image/png",
          sizeBytes: 1,
        });

      // Insert out of chronological order, then stamp distinct createdAt.
      const first = await mk("first", note.id);
      const third = await mk("third", note.id);
      const second = await mk("second", note.id);
      const foreign = await mk("foreign", other.id);

      await stampCreatedAt(tx, first.id, "2026-01-01T00:00:01.000Z");
      await stampCreatedAt(tx, second.id, "2026-01-01T00:00:02.000Z");
      await stampCreatedAt(tx, third.id, "2026-01-01T00:00:03.000Z");

      const list = await assetsRepo.findByNote(tx, note.id);
      expect(list.map((a) => a.filename)).toEqual([
        "first.png",
        "second.png",
        "third.png",
      ]);
      // the other note's asset is excluded
      expect(list.map((a) => a.id)).not.toContain(foreign.id);

      // and the other note sees only its own asset
      expect(
        (await assetsRepo.findByNote(tx, other.id)).map((a) => a.id),
      ).toEqual([foreign.id]);
    });
  });

  it("listAll returns every asset ordered by createdAt asc", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "N",
        slug: "n",
        body: "",
      });
      const attached = await assetsRepo.create(tx, {
        noteId: note.id,
        blobUrl: "https://blob/a",
        pathname: "vault/a.png",
        filename: "a.png",
        mimeType: "image/png",
        sizeBytes: 1,
      });
      const orphan = await assetsRepo.create(tx, {
        blobUrl: "https://blob/b",
        pathname: "vault/b.png",
        filename: "b.png",
        mimeType: "image/png",
        sizeBytes: 2,
      });

      await stampCreatedAt(tx, orphan.id, "2026-01-01T00:00:01.000Z");
      await stampCreatedAt(tx, attached.id, "2026-01-01T00:00:02.000Z");

      const all = await assetsRepo.listAll(tx);
      expect(all.map((a) => a.id)).toEqual([orphan.id, attached.id]);
    });
  });

  it("remove deletes the row, returns it, and a later findById is null", async () => {
    await run(async (tx) => {
      const asset = await assetsRepo.create(tx, {
        blobUrl: "https://blob/gone",
        pathname: "vault/gone.png",
        filename: "gone.png",
        mimeType: "image/png",
        sizeBytes: 99,
      });

      const removed = await assetsRepo.remove(tx, asset.id);
      expect(removed?.id).toBe(asset.id);
      expect(removed?.blobUrl).toBe("https://blob/gone");

      expect(await assetsRepo.findById(tx, asset.id)).toBeNull();
    });
  });

  it("remove of a missing id returns null", async () => {
    await run(async (tx) => {
      expect(await assetsRepo.remove(tx, MISSING)).toBeNull();
    });
  });

  it("hard-deleting a note sets its assets' note_id to null (ON DELETE SET NULL)", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "Doomed",
        slug: "doomed",
        body: "",
      });
      const asset = await assetsRepo.create(tx, {
        noteId: note.id,
        blobUrl: "https://blob/keep",
        pathname: "vault/keep.png",
        filename: "keep.png",
        mimeType: "image/png",
        sizeBytes: 7,
      });
      expect(asset.noteId).toBe(note.id);

      await notesRepo.hardDelete(tx, note.id);

      // the asset row survives, orphaned
      const survivor = await assetsRepo.findById(tx, asset.id);
      expect(survivor).not.toBeNull();
      expect(survivor?.noteId).toBeNull();
    });
  });
});
