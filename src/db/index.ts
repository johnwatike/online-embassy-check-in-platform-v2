import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// The SQLite database file lives inside the repository (data/app.db) and is
// committed to git, so the sample data ships with the source code.
// Override with SQLITE_PATH if you need a different location.
const dbFile = process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "app.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsSqliteDatabase?: Database.Database;
};

export const sqlite =
  globalForDb.__arenaNextJsSqliteDatabase ??
  (() => {
    const instance = new Database(dbFile);
    instance.pragma("journal_mode = DELETE");
    instance.pragma("synchronous = NORMAL");
    instance.pragma("busy_timeout = 10000");
    instance.pragma("foreign_keys = ON");
    return instance;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsSqliteDatabase = sqlite;
}

export const db = drizzle(sqlite, { schema });

/**
 * Runs `fn` inside a SQLite transaction. The better-sqlite3 driver is fully
 * synchronous, so drizzle's own `db.transaction` rejects async callbacks;
 * this helper keeps the familiar await-style while remaining atomic
 * (every statement runs to completion before the event loop advances).
 */
export async function withTransaction<T>(fn: (tx: typeof db) => Promise<T> | T): Promise<T> {
  db.run(sql`begin`);
  try {
    const result = await fn(db);
    db.run(sql`commit`);
    return result;
  } catch (err) {
    db.run(sql`rollback`);
    throw err;
  }
}
