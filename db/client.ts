import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core";
import { type ExtractTablesWithRelations } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Driver-agnostic database handle. Repositories accept this type so the same
 * code runs against Neon (HTTP, production) and pglite (in-process, tests), and
 * against a transaction (which also extends PgDatabase) — that is how the test
 * harness rolls each test back and how the PATCH cascade runs in one tx.
 */
export type Db = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

let cached: Db | undefined;

/** The production database (Neon pooled HTTP driver). Lazily constructed so
 * `next build` never touches an undefined DATABASE_URL. */
export function getDb(): Db {
  if (!cached) {
    const sql = neon(getEnv().DATABASE_URL);
    cached = drizzle(sql, { schema }) as unknown as Db;
  }
  return cached;
}

export { schema };
