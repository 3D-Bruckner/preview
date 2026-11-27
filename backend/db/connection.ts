// The data layer's connection (conventions: architecture/data-layer, stacks/sqlite): only backend/db/ holds better-sqlite3 and kysely;
// the rest of backend/ calls the store's functions (store.ts), and ESLint keeps the client and the migrations inside backend/db/.
//
// kysely builds the queries and better-sqlite3 runs them synchronously, so a domain function is one plain transaction (better-sqlite3's
// transaction(), savepoints when nested) with no await inside it for another request to slip into.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect, type Compilable } from "kysely";
import { migrate } from "next-app-kit/migrations";
import { MIGRATIONS } from "./migrations";
import type { DB } from "./schema";

/** What the queries run on: the query builder, and synchronous all/first/run of what it builds. */
export type Exec = {
  q: Kysely<DB>;
  all<O>(query: Compilable<O>): O[];
  first<O>(query: Compilable<O>): O | undefined;
  /** Runs a write; returns how many rows it changed. */
  run(query: Compilable<unknown>): number;
};

export type Connection = { exec: Exec; raw: Database.Database };

/** Opens DATA_DIR/preview.sqlite (creating the directory), in WAL mode with foreign keys on, and brings it to the last migration. */
export function openDatabase(dataDir: string): Connection {
  mkdirSync(dataDir, { recursive: true });
  const raw = new Database(join(dataDir, "preview.sqlite"));
  try {
    // The wait first: two processes opening a new file at once (the e2e server and a test's seed) would otherwise find it locked while
    // the other switches it to WAL or migrates it.
    raw.pragma("busy_timeout = 5000");
    raw.pragma("journal_mode = WAL");
    raw.pragma("foreign_keys = ON");
    migrate(raw, MIGRATIONS);
  } catch (e) {
    raw.close();
    throw e;
  }
  const q = new Kysely<DB>({ dialect: new SqliteDialect({ database: raw }) });
  const exec: Exec = {
    q,
    all: (query) => {
      const c = query.compile();
      return raw.prepare(c.sql).all(...c.parameters) as never;
    },
    first: (query) => {
      const c = query.compile();
      return raw.prepare(c.sql).get(...c.parameters) as never;
    },
    run: (query) => {
      const c = query.compile();
      return raw.prepare(c.sql).run(...c.parameters).changes;
    },
  };
  return { exec, raw };
}

/** Whether the database answers a query: false once it is closed or broken. */
export function databaseAnswers(raw: Database.Database): boolean {
  try {
    return raw.prepare("select 1 as one").get() !== undefined;
  } catch {
    return false;
  }
}
