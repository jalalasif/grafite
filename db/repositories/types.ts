/**
 * Domain types returned by repositories (§II.4). Repositories map Drizzle rows
 * to these at the boundary; services never see a Drizzle row type. The internal
 * `search_vector` column is deliberately absent — it is an index detail.
 */

export interface Note {
  id: string;
  title: string;
  slug: string;
  body: string;
  isDaily: boolean;
  dailyDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Tag {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
}

export interface Asset {
  id: string;
  noteId: string | null;
  blobUrl: string;
  pathname: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface Link {
  sourceId: string;
  targetId: string;
}

export interface UnresolvedLink {
  sourceId: string;
  targetSlug: string;
}

export type NoteSort = "updated" | "created" | "title";
