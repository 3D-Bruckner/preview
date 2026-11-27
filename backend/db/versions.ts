// The queries on versions and their drawings.
import type { Exec } from "./connection";
import type { DrawingRow, VersionRow } from "./schema";

export function versionQueries({ q, all, run }: Exec) {
  return {
    insertVersion: (row: VersionRow) => void run(q.insertInto("versions").values(row)),
    insertDrawing: (row: DrawingRow) => void run(q.insertInto("drawings").values(row)),
    /** A model's versions, newest (highest number) first. */
    versionsOfModel: (modelId: string): VersionRow[] => all(q.selectFrom("versions").selectAll().where("model_id", "=", modelId).orderBy("number", "desc")),
    /** The drawings of these versions, in their order. */
    drawingsOfVersions: (versionIds: string[]): DrawingRow[] =>
      versionIds.length === 0 ? [] : all(q.selectFrom("drawings").selectAll().where("version_id", "in", versionIds).orderBy("position")),
  };
}
