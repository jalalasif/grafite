import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  check,
  customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema (§II.2). The single source of truth for the tables; migrations
 * are generated from this file. Its behaviour is exercised through the
 * repository layer (§I.5), so the file itself carries no unit test.
 */

// Postgres tsvector — Drizzle has no built-in helper, so declare a custom type.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),
    isDaily: boolean("is_daily").notNull().default(false),
    dailyDate: date("daily_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`,
    ),
  },
  (t) => [
    index("notes_search_idx").using("gin", t.searchVector),
    index("notes_deleted_at_idx").on(t.deletedAt),
    // Partial uniques: soft-deleted notes must not squat on a slug or a date.
    uniqueIndex("notes_slug_live_idx")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("notes_daily_date_live_idx")
      .on(t.dailyDate)
      .where(sql`${t.deletedAt} is null`),
    check(
      "notes_daily_consistency",
      sql`(${t.isDaily} = false and ${t.dailyDate} is null) or (${t.isDaily} = true and ${t.dailyDate} is not null)`,
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    parentId: uuid("parent_id").references((): AnyPgColumn => tags.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tags_name_idx").on(t.name),
    index("tags_parent_idx").on(t.parentId),
  ],
);

export const noteTags = pgTable(
  "note_tags",
  {
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.tagId] }),
    index("note_tags_tag_idx").on(t.tagId),
  ],
);

export const links = pgTable(
  "links",
  {
    sourceId: uuid("source_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.targetId] }),
    index("links_target_idx").on(t.targetId),
  ],
);

export const unresolvedLinks = pgTable(
  "unresolved_links",
  {
    sourceId: uuid("source_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    targetSlug: text("target_slug").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.targetSlug] }),
    index("unresolved_links_slug_idx").on(t.targetSlug),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id").references(() => notes.id, {
      onDelete: "set null",
    }),
    blobUrl: text("blob_url").notNull(),
    pathname: text("pathname").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("assets_note_idx").on(t.noteId)],
);
