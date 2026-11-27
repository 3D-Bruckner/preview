// The Store: every query preview makes, bound to one connection. Domain code gets it as rt.store and never sees kysely or better-sqlite3;
// each table group adds its queries here (one file per group in backend/db/, spread into openStore).
import { databaseAnswers, openDatabase } from "./connection";
import { customerQueries } from "./customers";
import { modelQueries } from "./models";
import { versionQueries } from "./versions";

export type Store = ReturnType<typeof customerQueries> &
  ReturnType<typeof modelQueries> &
  ReturnType<typeof versionQueries> & {
    /** Runs `fn` in one transaction (a savepoint when nested): all its writes or none. */
    transaction<T>(fn: () => T): T;
    /** Whether the database answers: false once it is closed or broken. */
    answers(): boolean;
    close(): void;
  };

/** Opens DATA_DIR/preview.sqlite, migrated to the last schema, and the queries on it. */
export function openStore(dataDir: string): Store {
  const { exec, raw } = openDatabase(dataDir);
  return {
    ...customerQueries(exec),
    ...modelQueries(exec),
    ...versionQueries(exec),
    transaction: (fn) => raw.transaction(fn)(),
    answers: () => databaseAnswers(raw),
    close: () => raw.close(),
  };
}
