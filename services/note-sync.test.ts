import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, withRollback, type TestDb } from "@/db/testing";
import { createNote, updateNote } from "./note-sync";
import { notesRepo } from "@/db/repositories/notes";
import { tagsRepo } from "@/db/repositories/tags";
import { linksRepo } from "@/db/repositories/links";

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h.close();
});
const run = <T>(fn: Parameters<typeof withRollback<T>>[1]) =>
  withRollback(h.db, fn);

describe("createNote", () => {
  it("derives title and slug from the body", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, { body: "# Reading Calvino\n\nnotes" });
      expect(note.title).toBe("Reading Calvino");
      expect(note.slug).toBe("reading-calvino");
    });
  });

  it("falls back to Untitled/untitled for an empty body", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, { body: "" });
      expect(note.title).toBe("Untitled");
      expect(note.slug).toBe("untitled");
    });
  });

  it("gives colliding titles distinct slugs", async () => {
    await run(async (tx) => {
      const a = await createNote(tx, { body: "# Same" });
      const b = await createNote(tx, { body: "# Same" });
      expect(a.slug).toBe("same");
      expect(b.slug).toBe("same-2");
    });
  });

  it("materialises tags and attaches the leaf only", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, {
        body: "# T\n\nabout #books/fiction/calvino",
      });
      const names = (await tagsRepo.listAll(tx)).map((t) => t.name).sort();
      expect(names).toEqual([
        "books",
        "books/fiction",
        "books/fiction/calvino",
      ]);
      const leaf = (await tagsRepo.tagsForNote(tx, note.id)).map((t) => t.name);
      expect(leaf).toEqual(["books/fiction/calvino"]);
    });
  });

  it("records resolved and unresolved wikilinks", async () => {
    await run(async (tx) => {
      const target = await createNote(tx, { body: "# Target" });
      const source = await createNote(tx, {
        body: "see [[target]] and [[ghost]]",
      });
      const resolved = await linksRepo.linksFrom(tx, source.id);
      expect(resolved.map((l) => l.targetId)).toEqual([target.id]);
      const unresolved = await linksRepo.unresolvedFrom(tx, source.id);
      expect(unresolved.map((u) => u.targetSlug)).toEqual(["ghost"]);
      // backlink visible from the target
      expect(await linksRepo.backlinkSourceIds(tx, target.id)).toEqual([
        source.id,
      ]);
    });
  });

  it("heals a previously-unresolved link when the target note is created", async () => {
    await run(async (tx) => {
      const a = await createNote(tx, { body: "links to [[b]]" });
      expect((await linksRepo.unresolvedFrom(tx, a.id)).length).toBe(1);
      expect(await linksRepo.linksFrom(tx, a.id)).toEqual([]);

      // Create note B whose derived slug is "b"
      const b = await createNote(tx, { body: "b" });
      expect(b.slug).toBe("b");

      // A's link has healed: unresolved gone, resolved points at B
      expect(await linksRepo.unresolvedFrom(tx, a.id)).toEqual([]);
      expect(
        (await linksRepo.linksFrom(tx, a.id)).map((l) => l.targetId),
      ).toEqual([b.id]);
    });
  });

  it("creates a daily note with the date as title and slug", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, {
        body: "# 2026-07-15\n\njournal",
        isDaily: true,
        dailyDate: "2026-07-15",
      });
      expect(note.title).toBe("2026-07-15");
      expect(note.slug).toBe("2026-07-15");
      expect(note.isDaily).toBe(true);
      expect(note.dailyDate).toBe("2026-07-15");
    });
  });
});

describe("updateNote", () => {
  it("re-derives the title and re-parses tags/links", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, { body: "# First\n\n#alpha" });
      const updated = await updateNote(tx, note.id, "# Second\n\n#beta");
      expect(updated?.title).toBe("Second");
      const leaf = (await tagsRepo.tagsForNote(tx, note.id)).map((t) => t.name);
      expect(leaf).toEqual(["beta"]);
    });
  });

  it("keeps the slug stable across a title change", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, { body: "# Original" });
      const updated = await updateNote(tx, note.id, "# Renamed Entirely");
      expect(updated?.slug).toBe("original"); // frozen
    });
  });

  it("garbage-collects a tag once its last note drops it", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, { body: "# T\n\n#temp/sub" });
      expect((await tagsRepo.listAll(tx)).length).toBe(2);
      await updateNote(tx, note.id, "# T\n\nno tags now");
      expect(await tagsRepo.listAll(tx)).toEqual([]);
    });
  });

  it("returns null for a missing note", async () => {
    await run(async (tx) => {
      expect(
        await updateNote(tx, "00000000-0000-0000-0000-000000000000", "x"),
      ).toBeNull();
    });
  });
});
