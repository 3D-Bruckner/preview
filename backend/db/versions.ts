// The queries on versions and their drawings.
import type { Exec } from "./connection";
import type { DrawingRow, VersionRow } from "./schema";

export function versionQueries({ q, all, run }: Exec) {
  return {
    insertVersion: (row: VersionRow) => void run(q.insertInto("versions").values(row)),
    insertDrawing: (row: DrawingRow) => void run(q.insertInto("drawings").values(row)),
    version: (id: string): VersionRow | undefined => all(q.selectFrom("versions").selectAll().where("id", "=", id))[0],
    /** The highest version number a model has, null when it has none. */
    maxVersionNumber: (modelId: string): number | null =>
      all(q.selectFrom("versions").select("number").where("model_id", "=", modelId).orderBy("number", "desc").limit(1))[0]?.number ?? null,
    drawing: (versionId: string, id: string): DrawingRow | undefined =>
      all(q.selectFrom("drawings").selectAll().where("version_id", "=", versionId).where("id", "=", id))[0],
    /** A model's versions, newest (highest number) first. */
    versionsOfModel: (modelId: string): VersionRow[] => all(q.selectFrom("versions").selectAll().where("model_id", "=", modelId).orderBy("number", "desc")),
    /** The drawings of these versions, in their order. */
    drawingsOfVersions: (versionIds: string[]): DrawingRow[] =>
      versionIds.length === 0 ? [] : all(q.selectFrom("drawings").selectAll().where("version_id", "in", versionIds).orderBy("position")),
  };
}
