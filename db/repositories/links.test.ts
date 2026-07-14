import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, withRollback, type TestDb } from "../testing";
import { notesRepo } from "./notes";
import { linksRepo } from "./links";

let h: TestDb;
beforeAll(async () => {
  h = await createTestDb();
});
afterAll(async () => {
  await h.close();
});
const run = <T>(fn: Parameters<typeof withRollback<T>>[1]) =>
  withRollback(h.db, fn);

// Real notes are required to satisfy the FK on links.source_id / target_id and
// unresolved_links.source_id, so every test seeds notes via notesRepo.
let n = 0;
const makeNote = (db: Parameters<typeof notesRepo.create>[0], slug?: string) =>
  notesRepo.create(db, {
    title: slug ?? `note-${++n}`,
    slug: slug ?? `note-${++n}`,
    body: "",
  });

describe("linksRepo", () => {
  it("replaceForSource inserts resolved and unresolved rows", async () => {
    await run(async (tx) => {
      const src = await makeNote(tx);
      const a = await makeNote(tx);
      const b = await makeNote(tx);

      await linksRepo.replaceForSource(
        tx,
        src.id,
        [a.id, b.id],
        ["ghost", "phantom"],
      );

      const resolved = await linksRepo.linksFrom(tx, src.id);
      expect(resolved).toHaveLength(2);
      expect(resolved.map((l) => l.targetId).sort()).toEqual(
        [a.id, b.id].sort(),
      );
      expect(resolved.every((l) => l.sourceId === src.id)).toBe(true);

      const unresolved = await linksRepo.unresolvedFrom(tx, src.id);
      expect(unresolved.map((u) => u.targetSlug).sort()).toEqual([
        "ghost",
        "phantom",
      ]);
      expect(unresolved.every((u) => u.sourceId === src.id)).toBe(true);
    });
  });

  it("replaceForSource replaces the previous set on a second call", async () => {
    await run(async (tx) => {
      const src = await makeNote(tx);
      const a = await makeNote(tx);
      const b = await makeNote(tx);

      await linksRepo.replaceForSource(tx, src.id, [a.id], ["old-slug"]);
      // Second call fully supersedes the first.
      await linksRepo.replaceForSource(tx, src.id, [b.id], ["new-slug"]);

      const resolved = await linksRepo.linksFrom(tx, src.id);
      expect(resolved.map((l) => l.targetId)).toEqual([b.id]);

      const unresolved = await linksRepo.unresolvedFrom(tx, src.id);
      expect(unresolved.map((u) => u.targetSlug)).toEqual(["new-slug"]);
    });
  });

  it("replaceForSource de-dupes repeated targets and slugs", async () => {
    await run(async (tx) => {
      const src = await makeNote(tx);
      const a = await makeNote(tx);

      await linksRepo.replaceForSource(
        tx,
        src.id,
        [a.id, a.id, a.id],
        ["dup", "dup"],
      );

      expect(await linksRepo.linksFrom(tx, src.id)).toHaveLength(1);
      const unresolved = await linksRepo.unresolvedFrom(tx, src.id);
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0]!.targetSlug).toBe("dup");
    });
  });

  it("replaceForSource with empty arrays clears existing rows", async () => {
    await run(async (tx) => {
      const src = await makeNote(tx);
      const a = await makeNote(tx);

      await linksRepo.replaceForSource(tx, src.id, [a.id], ["slug"]);
      expect(await linksRepo.linksFrom(tx, src.id)).toHaveLength(1);
      expect(await linksRepo.unresolvedFrom(tx, src.id)).toHaveLength(1);

      await linksRepo.replaceForSource(tx, src.id, [], []);
      expect(await linksRepo.linksFrom(tx, src.id)).toHaveLength(0);
      expect(await linksRepo.unresolvedFrom(tx, src.id)).toHaveLength(0);
    });
  });

  it("backlinkSourceIds returns the distinct sources linking to a target", async () => {
    await run(async (tx) => {
      const target = await makeNote(tx);
      const s1 = await makeNote(tx);
      const s2 = await makeNote(tx);
      const other = await makeNote(tx);

      await linksRepo.replaceForSource(tx, s1.id, [target.id], []);
      await linksRepo.replaceForSource(tx, s2.id, [target.id], []);
      // A link to some other note must not appear in target's backlinks.
      await linksRepo.replaceForSource(tx, other.id, [s1.id], []);

      const backlinks = await linksRepo.backlinkSourceIds(tx, target.id);
      expect(backlinks.sort()).toEqual([s1.id, s2.id].sort());
      expect(await linksRepo.backlinkSourceIds(tx, other.id)).toEqual([]);
    });
  });

  it("unresolvedBySlug returns the sources whose broken link uses that slug", async () => {
    await run(async (tx) => {
      const s1 = await makeNote(tx);
      const s2 = await makeNote(tx);

      await linksRepo.replaceForSource(tx, s1.id, [], ["wanted"]);
      await linksRepo.replaceForSource(tx, s2.id, [], ["wanted", "unrelated"]);

      const rows = await linksRepo.unresolvedBySlug(tx, "wanted");
      expect(rows.map((r) => r.sourceId).sort()).toEqual([s1.id, s2.id].sort());
      expect(rows.every((r) => r.targetSlug === "wanted")).toBe(true);

      expect(await linksRepo.unresolvedBySlug(tx, "missing")).toEqual([]);
    });
  });

  it("heal moves unresolved rows into links and returns the count", async () => {
    await run(async (tx) => {
      const s1 = await makeNote(tx);
      const s2 = await makeNote(tx);
      const healed = await makeNote(tx, "healed-slug");

      await linksRepo.replaceForSource(tx, s1.id, [], ["healed-slug"]);
      await linksRepo.replaceForSource(tx, s2.id, [], ["healed-slug"]);

      const count = await linksRepo.heal(tx, "healed-slug", healed.id);
      expect(count).toBe(2);

      // Unresolved rows are gone, resolved links now exist.
      expect(await linksRepo.unresolvedBySlug(tx, "healed-slug")).toEqual([]);
      expect(await linksRepo.linksFrom(tx, s1.id)).toEqual([
        { sourceId: s1.id, targetId: healed.id },
      ]);
      expect(await linksRepo.backlinkSourceIds(tx, healed.id)).toHaveLength(2);
    });
  });

  it("heal is safe when a resolved link already exists (no PK conflict)", async () => {
    await run(async (tx) => {
      const src = await makeNote(tx);
      const target = await makeNote(tx, "target-slug");

      // src already resolves to target, AND has a stale unresolved row for the
      // same slug — healing must not blow up on the duplicate links PK.
      await linksRepo.replaceForSource(
        tx,
        src.id,
        [target.id],
        ["target-slug"],
      );

      const count = await linksRepo.heal(tx, "target-slug", target.id);
      expect(count).toBe(1);
      expect(await linksRepo.linksFrom(tx, src.id)).toEqual([
        { sourceId: src.id, targetId: target.id },
      ]);
      expect(await linksRepo.unresolvedFrom(tx, src.id)).toEqual([]);
    });
  });

  it("heal returns 0 when nothing matches the slug", async () => {
    await run(async (tx) => {
      const target = await makeNote(tx);
      expect(await linksRepo.heal(tx, "no-such-slug", target.id)).toBe(0);
      expect(await linksRepo.linksFrom(tx, target.id)).toEqual([]);
    });
  });
});
