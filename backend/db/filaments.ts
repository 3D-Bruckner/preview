// The queries on filaments: the operator's filaments (backend/filaments.ts).
import type { Exec } from "./connection";
import type { FilamentRow } from "./schema";

export function filamentQueries({ q, all, run }: Exec) {
  return {
    /** Every filament in its order (position, then when it was made). */
    filaments: (): FilamentRow[] => all(q.selectFrom("filaments").selectAll().orderBy("position").orderBy("created_at")),
    filament: (id: string): FilamentRow | undefined => all(q.selectFrom("filaments").selectAll().where("id", "=", id))[0],
    /** The next position: one after the last. */
    nextFilamentPosition: (): number => (all(q.selectFrom("filaments").select((e) => e.fn.max("position").as("last")))[0]?.last ?? 0) + 1,
    insertFilament: (row: FilamentRow) => void run(q.insertInto("filaments").values(row)),
    /** Whether there was such a filament. */
    updateFilament: (id: string, set: Partial<Omit<FilamentRow, "id" | "created_at">>): boolean =>
      run(q.updateTable("filaments").set(set).where("id", "=", id)) > 0,
    deleteFilament: (id: string): boolean => run(q.deleteFrom("filaments").where("id", "=", id)) > 0,
  };
}
