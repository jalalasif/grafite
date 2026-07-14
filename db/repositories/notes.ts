import { eq, and, isNull, isNotNull, desc, asc, sql } from "drizzle-orm";
import { notes } from "../schema";
import { type Db } from "../client";
import { type Note, type NoteSort } from "./types";

/**
 * Notes data access (§II.4). The only place notes-table Drizzle queries live;
 * returns the {@link Note} domain type (never a raw row — the internal
 * search_vector column is not selected). Every "live" query filters
 * `deleted_at IS NULL` so soft-deleted notes stay out of sight.
 */

// Explicit column projection = the domain shape, and keeps the big tsvector off
// the wire.
const cols = {
  id: notes.id,
  title: notes.title,
  slug: notes.slug,
  body: notes.body,
  isDaily: notes.isDaily,
  dailyDate: notes.dailyDate,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
  deletedAt: notes.deletedAt,
};

export interface NewNote {
  title: string;
  slug: string;
  body?: string;
  isDaily?: boolean;
  dailyDate?: string | null;
}

export const notesRepo = {
  async create(db: Db, input: NewNote): Promise<Note> {
    const [row] = await db
      .insert(notes)
      .values({
        title: input.title,
        slug: input.slug,
        body: input.body ?? "",
        isDaily: input.isDaily ?? false,
        dailyDate: input.dailyDate ?? null,
      })
      .returning(cols);
    return row!;
  },

  async findById(db: Db, id: string): Promise<Note | null> {
    const [row] = await db
      .select(cols)
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1);
    return row ?? null;
  },

  async findBySlug(db: Db, slug: string): Promise<Note | null> {
    const [row] = await db
      .select(cols)
      .from(notes)
      .where(and(eq(notes.slug, slug), isNull(notes.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  async slugExists(db: Db, slug: string): Promise<boolean> {
    const rows = await db
      .select({ one: sql`1` })
      .from(notes)
      .where(and(eq(notes.slug, slug), isNull(notes.deletedAt)))
      .limit(1);
    return rows.length > 0;
  },

  async updateContent(
    db: Db,
    id: string,
    patch: { title: string; body: string },
  ): Promise<Note | null> {
    const [row] = await db
      .update(notes)
      .set({ title: patch.title, body: patch.body, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning(cols);
    return row ?? null;
  },

  async softDelete(db: Db, id: string): Promise<Note | null> {
    const [row] = await db
      .update(notes)
      .set({ deletedAt: new Date() })
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .returning(cols);
    return row ?? null;
  },

  async restore(db: Db, id: string): Promise<Note | null> {
    const [row] = await db
      .update(notes)
      .set({ deletedAt: null })
      .where(eq(notes.id, id))
      .returning(cols);
    return row ?? null;
  },

  async hardDelete(db: Db, id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  },

  async listTrashed(db: Db): Promise<Note[]> {
    return db
      .select(cols)
      .from(notes)
      .where(isNotNull(notes.deletedAt))
      .orderBy(desc(notes.deletedAt));
  },

  async findDailyByDate(db: Db, date: string): Promise<Note | null> {
    const [row] = await db
      .select(cols)
      .from(notes)
      .where(
        and(
          eq(notes.dailyDate, date),
          eq(notes.isDaily, true),
          isNull(notes.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async list(
    db: Db,
    opts: { sort?: NoteSort; limit?: number } = {},
  ): Promise<Note[]> {
    const order =
      opts.sort === "created"
        ? desc(notes.createdAt)
        : opts.sort === "title"
          ? asc(notes.title)
          : desc(notes.updatedAt);
    const base = db
      .select(cols)
      .from(notes)
      .where(isNull(notes.deletedAt))
      .orderBy(order);
    return opts.limit ? base.limit(opts.limit) : base;
  },
};
