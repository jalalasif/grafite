import { eq, asc } from "drizzle-orm";
import { assets } from "../schema";
import { type Db } from "../client";
import { type Asset } from "./types";

/**
 * Assets data access (§II.6). The only place assets-table Drizzle queries live;
 * returns the {@link Asset} domain type via an explicit column projection.
 * Serves asset upload (§II.6.1), export (§II.6.8), and trash purge (§II.6.9).
 * A note's deletion sets its assets' `note_id` to null (ON DELETE SET NULL),
 * so orphaned blobs remain listable for the vault export.
 */

// Explicit column projection = the domain shape.
const cols = {
  id: assets.id,
  noteId: assets.noteId,
  blobUrl: assets.blobUrl,
  pathname: assets.pathname,
  filename: assets.filename,
  mimeType: assets.mimeType,
  sizeBytes: assets.sizeBytes,
  createdAt: assets.createdAt,
};

export interface NewAsset {
  noteId?: string | null;
  blobUrl: string;
  pathname: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export const assetsRepo = {
  async create(db: Db, input: NewAsset): Promise<Asset> {
    const [row] = await db
      .insert(assets)
      .values({
        noteId: input.noteId ?? null,
        blobUrl: input.blobUrl,
        pathname: input.pathname,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      .returning(cols);
    return row!;
  },

  async findById(db: Db, id: string): Promise<Asset | null> {
    const [row] = await db
      .select(cols)
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);
    return row ?? null;
  },

  async findByNote(db: Db, noteId: string): Promise<Asset[]> {
    return db
      .select(cols)
      .from(assets)
      .where(eq(assets.noteId, noteId))
      .orderBy(asc(assets.createdAt));
  },

  async listAll(db: Db): Promise<Asset[]> {
    return db.select(cols).from(assets).orderBy(asc(assets.createdAt));
  },

  async remove(db: Db, id: string): Promise<Asset | null> {
    const [row] = await db
      .delete(assets)
      .where(eq(assets.id, id))
      .returning(cols);
    return row ?? null;
  },
};
