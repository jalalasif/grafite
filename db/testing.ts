import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { type Db } from "./client";
import * as schema from "./schema";

/**
 * Integration-test database: a real in-process Postgres (pglite), migrated from
 * the committed migration files (DT-4 in conventions.md — pglite handles the
 * generated tsvector column, partial uniques, and check constraints, verified
 * before committing to it). The database is never mocked (§II.10).
 */
export interface TestDb {
  db: Db;
  close: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  return {
    db: db as unknown as Db,
    close: () => client.close(),
  };
}

/** Sentinel thrown to abort a transaction so the test's writes roll back. */
class Rollback extends Error {}

/**
 * Run `fn` inside a transaction and always roll it back, so each test starts
 * from the migrated-but-empty baseline without re-applying migrations (§II.10:
 * "each test runs in a transaction that rolls back"). The transaction handle is
 * a `Db`, so repositories run against it unchanged.
 */
export async function withRollback<T>(
  db: Db,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx as unknown as Db);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result!;
}
