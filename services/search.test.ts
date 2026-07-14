import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, withRollback, type TestDb } from "@/db/testing";
import { createNote, updateNote } from "./note-sync";
import { notesRepo } from "@/db/repositories/notes";
import { search } from "./search";

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h.close();
});
const run = <T>(fn: Parameters<typeof withRollback<T>>[1]) =>
  withRollback(h.db, fn);

describe("search — free-text FTS", () => {
  it("ranks a title match above a body-only match", async () => {
    await run(async (tx) => {
      // Term in the title → weight A (also appears in the body via the H1).
      const titleHit = await createNote(tx, {
        body: "# Calvino Reading Notes\n\nsome unrelated prose",
      });
      // Term only in the body → weight B, and the title omits it entirely.
      const bodyHit = await createNote(tx, {
        body: "# Grocery List\n\nremember to read Calvino tonight",
      });

      const results = await search(tx, "Calvino");
      expect(results.map((r) => r.note.id)).toEqual([titleHit.id, bodyHit.id]);
      expect(results[0]!.rank).toBeGreaterThan(results[1]!.rank);
    });
  });

  it("honours a quoted phrase (websearch grammar)", async () => {
    await run(async (tx) => {
      const phrase = await createNote(tx, {
        body: "# Pangram\n\nThe quick brown fox jumps over the lazy dog",
      });
      // Same words, wrong order → no adjacency, so no phrase match.
      await createNote(tx, {
        body: "# Scatter\n\na brown thing, and quick foxes running about",
      });

      const results = await search(tx, '"quick brown fox"');
      expect(results.map((r) => r.note.id)).toEqual([phrase.id]);
    });
  });

  it("produces a <mark>-highlighted snippet", async () => {
    await run(async (tx) => {
      await createNote(tx, {
        body: "# Astronomy\n\nthe supernova was visible for weeks",
      });
      const results = await search(tx, "supernova");
      expect(results).toHaveLength(1);
      expect(results[0]!.snippet).toContain("<mark>");
      expect(results[0]!.snippet.toLowerCase()).toContain("supernova");
    });
  });

  it("excludes soft-deleted notes", async () => {
    await run(async (tx) => {
      const note = await createNote(tx, {
        body: "# Zebra\n\na note about a zebra",
      });
      expect(await search(tx, "zebra")).toHaveLength(1);
      await notesRepo.softDelete(tx, note.id);
      expect(await search(tx, "zebra")).toEqual([]);
    });
  });

  it("respects opts.limit", async () => {
    await run(async (tx) => {
      await createNote(tx, { body: "# Widget one\n\nwidget alpha" });
      await createNote(tx, { body: "# Widget two\n\nwidget beta" });
      await createNote(tx, { body: "# Widget three\n\nwidget gamma" });
      const results = await search(tx, "widget", { limit: 2 });
      expect(results).toHaveLength(2);
    });
  });
});

describe("search — tag scope", () => {
  it("scopes to a tag and its descendants, excluding others", async () => {
    await run(async (tx) => {
      // Descendant of books/fiction.
      const descendant = await createNote(tx, {
        body: "# Dune\n\n#books/fiction/herbert set in outer space",
      });
      // Exactly books/fiction.
      const exact = await createNote(tx, {
        body: "# Essay\n\n#books/fiction essays about space",
      });
      // A sibling branch — must be excluded.
      await createNote(tx, {
        body: "# Cookbook\n\n#books/nonfiction/food space between courses",
      });

      const results = await search(tx, "tag:books/fiction space");
      expect(results.map((r) => r.note.id).sort()).toEqual(
        [descendant.id, exact.id].sort(),
      );
    });
  });

  it("returns [] when no note carries the tag", async () => {
    await run(async (tx) => {
      await createNote(tx, { body: "# Note\n\nplain content" });
      expect(await search(tx, "tag:ghosttag content")).toEqual([]);
    });
  });
});

describe("search — is:daily scope", () => {
  it("scopes to daily notes", async () => {
    await run(async (tx) => {
      const daily = await createNote(tx, {
        body: "# 2026-07-15\n\nstandup about the launch",
        isDaily: true,
        dailyDate: "2026-07-15",
      });
      await createNote(tx, { body: "# Launch Plan\n\nlaunch details here" });

      const results = await search(tx, "is:daily launch");
      expect(results.map((r) => r.note.id)).toEqual([daily.id]);
      expect(results[0]!.note.isDaily).toBe(true);
    });
  });

  it("combines tag, is:daily, and free text", async () => {
    await run(async (tx) => {
      // Matches all three constraints.
      const match = await createNote(tx, {
        body: "# 2026-07-10\n\n#work/sprint standup notes about the launch",
        isDaily: true,
        dailyDate: "2026-07-10",
      });
      // Right tag + term, but not daily.
      await createNote(tx, {
        body: "# Doc\n\n#work/sprint launch planning",
      });
      // Daily + term, but no tag.
      await createNote(tx, {
        body: "# 2026-07-11\n\nlaunch chatter with no tag",
        isDaily: true,
        dailyDate: "2026-07-11",
      });

      const results = await search(tx, "tag:work is:daily launch");
      expect(results.map((r) => r.note.id)).toEqual([match.id]);
    });
  });
});

describe("search — scope-only and empty", () => {
  it("returns scoped notes newest-first with rank 0 and a plain snippet", async () => {
    await run(async (tx) => {
      const d1 = await createNote(tx, {
        body: "# 2026-07-01\n\nfirst journal entry",
        isDaily: true,
        dailyDate: "2026-07-01",
      });
      const d2 = await createNote(tx, {
        body: "# 2026-07-02\n\nsecond journal entry",
        isDaily: true,
        dailyDate: "2026-07-02",
      });
      await createNote(tx, { body: "# Normal\n\nnot a daily note" });

      // Bump d2's updated_at to a real wall-clock time so it sorts first.
      await updateNote(tx, d2.id, "# 2026-07-02\n\nsecond journal edited");

      const results = await search(tx, "is:daily");
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.note.id).sort()).toEqual(
        [d1.id, d2.id].sort(),
      );
      // Most-recently-updated first.
      expect(results[0]!.note.id).toBe(d2.id);
      // rank 0 and a plain body-prefix snippet (never highlighted).
      for (const r of results) {
        expect(r.rank).toBe(0);
        expect(r.snippet).not.toContain("<mark>");
        expect(r.snippet).toBe(r.note.body.slice(0, 160));
      }
    });
  });

  it("returns [] for an empty or whitespace-only query", async () => {
    await run(async (tx) => {
      await createNote(tx, { body: "# Something\n\nsome text" });
      expect(await search(tx, "")).toEqual([]);
      expect(await search(tx, "   ")).toEqual([]);
    });
  });
});
