import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, withRollback, type TestDb } from "../testing";
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

describe("notesRepo", () => {
  it("creates a note and finds it by id, returning a domain type", async () => {
    await run(async (tx) => {
      const note = await notesRepo.create(tx, {
        title: "Calvino",
        slug: "calvino",
        body: "invisible cities",
      });
      expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(note.title).toBe("Calvino");
      expect(note.slug).toBe("calvino");
      expect(note.isDaily).toBe(false);
      expect(note.deletedAt).toBeNull();
      // domain type has no search_vector
      expect("searchVector" in note).toBe(false);

      const found = await notesRepo.findById(tx, note.id);
      expect(found?.id).toBe(note.id);
    });
  });

  it("returns null for a missing id", async () => {
    await run(async (tx) => {
      expect(
        await notesRepo.findById(tx, "00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
    });
  });

  it("finds a live note by slug and ignores soft-deleted ones", async () => {
    await run(async (tx) => {
      const n = await notesRepo.create(tx, {
        title: "T",
        slug: "s",
        body: "b",
      });
      expect((await notesRepo.findBySlug(tx, "s"))?.id).toBe(n.id);
      await notesRepo.softDelete(tx, n.id);
      expect(await notesRepo.findBySlug(tx, "s")).toBeNull();
    });
  });

  it("slugExists reflects live notes only", async () => {
    await run(async (tx) => {
      expect(await notesRepo.slugExists(tx, "x")).toBe(false);
      const n = await notesRepo.create(tx, { title: "X", slug: "x", body: "" });
      expect(await notesRepo.slugExists(tx, "x")).toBe(true);
      await notesRepo.softDelete(tx, n.id);
      expect(await notesRepo.slugExists(tx, "x")).toBe(false);
    });
  });

  it("lets a soft-deleted slug be reused (partial unique)", async () => {
    await run(async (tx) => {
      const a = await notesRepo.create(tx, {
        title: "A",
        slug: "dup",
        body: "",
      });
      await notesRepo.softDelete(tx, a.id);
      const b = await notesRepo.create(tx, {
        title: "B",
        slug: "dup",
        body: "",
      });
      expect(b.id).not.toBe(a.id);
      expect((await notesRepo.findBySlug(tx, "dup"))?.id).toBe(b.id);
    });
  });

  it("updates content and bumps updated_at", async () => {
    await run(async (tx) => {
      const n = await notesRepo.create(tx, {
        title: "Old",
        slug: "u",
        body: "old",
      });
      const updated = await notesRepo.updateContent(tx, n.id, {
        title: "New",
        body: "new body",
      });
      expect(updated?.title).toBe("New");
      expect(updated?.body).toBe("new body");
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        n.updatedAt.getTime(),
      );
    });
  });

  it("soft-deletes, lists in trash, and restores", async () => {
    await run(async (tx) => {
      const n = await notesRepo.create(tx, {
        title: "Trash me",
        slug: "tm",
        body: "",
      });
      await notesRepo.softDelete(tx, n.id);
      const trashed = await notesRepo.listTrashed(tx);
      expect(trashed.map((t) => t.id)).toContain(n.id);

      await notesRepo.restore(tx, n.id);
      expect(await notesRepo.findBySlug(tx, "tm")).not.toBeNull();
      expect((await notesRepo.listTrashed(tx)).map((t) => t.id)).not.toContain(
        n.id,
      );
    });
  });

  it("hard-deletes a note", async () => {
    await run(async (tx) => {
      const n = await notesRepo.create(tx, {
        title: "Gone",
        slug: "g",
        body: "",
      });
      await notesRepo.hardDelete(tx, n.id);
      expect(await notesRepo.findById(tx, n.id)).toBeNull();
    });
  });

  it("creates and finds a daily note by date; one live per date", async () => {
    await run(async (tx) => {
      const d = await notesRepo.create(tx, {
        title: "2026-07-15",
        slug: "2026-07-15",
        body: "# journal",
        isDaily: true,
        dailyDate: "2026-07-15",
      });
      const found = await notesRepo.findDailyByDate(tx, "2026-07-15");
      expect(found?.id).toBe(d.id);
      expect(found?.isDaily).toBe(true);

      await expect(
        notesRepo.create(tx, {
          title: "dup daily",
          slug: "dup-daily",
          body: "",
          isDaily: true,
          dailyDate: "2026-07-15",
        }),
      ).rejects.toThrow();
    });
  });

  it("lists live notes sorted by updated desc, and by title asc", async () => {
    await run(async (tx) => {
      const a = await notesRepo.create(tx, {
        title: "Zebra",
        slug: "z",
        body: "",
      });
      const b = await notesRepo.create(tx, {
        title: "Apple",
        slug: "a",
        body: "",
      });
      // bump a's updated_at so it is most-recent
      await notesRepo.updateContent(tx, a.id, { title: "Zebra", body: "x" });

      const byUpdated = await notesRepo.list(tx, { sort: "updated" });
      expect(byUpdated[0]?.id).toBe(a.id);

      const byTitle = await notesRepo.list(tx, { sort: "title" });
      const titles = byTitle.map((n) => n.title);
      expect(titles.indexOf("Apple")).toBeLessThan(titles.indexOf("Zebra"));
      expect(byTitle.every((n) => n.deletedAt === null)).toBe(true);
      // soft-deleted notes are excluded
      await notesRepo.softDelete(tx, b.id);
      expect((await notesRepo.list(tx)).map((n) => n.id)).not.toContain(b.id);
    });
  });
});
