import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, withRollback, type TestDb } from "../testing";
import { tagsRepo } from "./tags";
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

describe("tagsRepo", () => {
  it("materialises a nested path with parent-chained ancestors, returning the leaf", async () => {
    await run(async (tx) => {
      const leaf = await tagsRepo.materializePath(tx, "books/fiction/calvino");
      expect(leaf.name).toBe("books/fiction/calvino");

      const books = await tagsRepo.findByName(tx, "books");
      const fiction = await tagsRepo.findByName(tx, "books/fiction");
      expect(books?.parentId).toBeNull();
      expect(fiction?.parentId).toBe(books?.id);
      expect(leaf.parentId).toBe(fiction?.id);
    });
  });

  it("is idempotent — re-materialising reuses existing rows", async () => {
    await run(async (tx) => {
      const first = await tagsRepo.materializePath(tx, "books/fiction");
      const second = await tagsRepo.materializePath(tx, "books/fiction");
      expect(second.id).toBe(first.id);
      const all = await tagsRepo.listAll(tx);
      expect(all.map((t) => t.name).sort()).toEqual(["books", "books/fiction"]);
    });
  });

  it("findByName returns null for an unknown tag", async () => {
    await run(async (tx) => {
      expect(await tagsRepo.findByName(tx, "nope")).toBeNull();
    });
  });

  it("sets and reads a note's leaf tags, and replaces them", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "N",
        slug: "n",
        body: "",
      });
      const a = await tagsRepo.materializePath(tx, "a");
      const b = await tagsRepo.materializePath(tx, "b");
      await tagsRepo.setNoteTags(tx, note.id, [a.id, b.id]);
      expect(
        (await tagsRepo.tagsForNote(tx, note.id)).map((t) => t.name).sort(),
      ).toEqual(["a", "b"]);

      // replace with just b
      await tagsRepo.setNoteTags(tx, note.id, [b.id]);
      expect(
        (await tagsRepo.tagsForNote(tx, note.id)).map((t) => t.name),
      ).toEqual(["b"]);

      // empty clears
      await tagsRepo.setNoteTags(tx, note.id, []);
      expect(await tagsRepo.tagsForNote(tx, note.id)).toEqual([]);
    });
  });

  it("finds note ids under a tag path and its descendants", async () => {
    await run(async (tx) => {
      const n1 = await notesRepo.create(tx, {
        title: "1",
        slug: "1",
        body: "",
      });
      const n2 = await notesRepo.create(tx, {
        title: "2",
        slug: "2",
        body: "",
      });
      const n3 = await notesRepo.create(tx, {
        title: "3",
        slug: "3",
        body: "",
      });
      const parent = await tagsRepo.materializePath(tx, "books");
      const child = await tagsRepo.materializePath(tx, "books/fiction");
      const other = await tagsRepo.materializePath(tx, "music");
      await tagsRepo.setNoteTags(tx, n1.id, [parent.id]);
      await tagsRepo.setNoteTags(tx, n2.id, [child.id]);
      await tagsRepo.setNoteTags(tx, n3.id, [other.id]);

      const under = await tagsRepo.noteIdsUnderPath(tx, "books");
      expect(under.sort()).toEqual([n1.id, n2.id].sort());
      expect(under).not.toContain(n3.id);
    });
  });

  it("does not let an underscore in a path act as a LIKE wildcard", async () => {
    await run(async (tx) => {
      const n = await notesRepo.create(tx, { title: "n", slug: "n", body: "" });
      const t = await tagsRepo.materializePath(tx, "a_b/child");
      const decoy = await tagsRepo.materializePath(tx, "axb");
      const nd = await notesRepo.create(tx, {
        title: "d",
        slug: "d",
        body: "",
      });
      await tagsRepo.setNoteTags(tx, n.id, [t.id]);
      await tagsRepo.setNoteTags(tx, nd.id, [decoy.id]);
      const under = await tagsRepo.noteIdsUnderPath(tx, "a_b");
      expect(under).toContain(n.id);
      expect(under).not.toContain(nd.id);
    });
  });

  it("prunes orphan tags with no notes and no tagged descendants", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "N",
        slug: "n",
        body: "",
      });
      const used = await tagsRepo.materializePath(tx, "keep/deep/leaf");
      await tagsRepo.materializePath(tx, "drop/me/entirely");
      await tagsRepo.setNoteTags(tx, note.id, [used.id]);

      const removed = await tagsRepo.pruneOrphans(tx);
      expect(removed).toBe(3); // drop, drop/me, drop/me/entirely
      const names = (await tagsRepo.listAll(tx)).map((t) => t.name).sort();
      expect(names).toEqual(["keep", "keep/deep", "keep/deep/leaf"]);
    });
  });

  it("prunes a whole ancestor chain once its last note is removed", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "N",
        slug: "n",
        body: "",
      });
      const leaf = await tagsRepo.materializePath(tx, "x/y/z");
      await tagsRepo.setNoteTags(tx, note.id, [leaf.id]);
      expect(await tagsRepo.pruneOrphans(tx)).toBe(0);

      await tagsRepo.setNoteTags(tx, note.id, []);
      expect(await tagsRepo.pruneOrphans(tx)).toBe(3);
      expect(await tagsRepo.listAll(tx)).toEqual([]);
    });
  });
});
