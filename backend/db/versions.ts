// The queries on versions and their drawings.
import type { Exec } from "./connection";
import type { DrawingRow, VersionRow } from "./schema";

export function versionQueries({ q, all, run }: Exec) {
  return {
    insertVersion: (row: VersionRow) => void run(q.insertInto("versions").values(row)),
    insertDrawing: (row: DrawingRow) => void run(q.insertInto("drawings").values(row)),
    setFacts: (id: string, facts: string | null) => void run(q.updateTable("versions").set({ facts }).where("id", "=", id)),
    /** Every version's id and facts, for finding those to read (again). */
    versionFacts: (): Pick<VersionRow, "id" | "facts">[] => all(q.selectFrom("versions").select(["id", "facts"]).orderBy("created_at")),
    version: (id: string): VersionRow | undefined => all(q.selectFrom("versions").selectAll().where("id", "=", id))[0],
    /** The highest version number a model has, null when it has none. */
    maxVersionNumber: (modelId: string): number | null =>
      all(q.selectFrom("versions").select("number").where("model_id", "=", modelId).orderBy("number", "desc").limit(1))[0]?.number ?? null,
    drawing: (versionId: string, id: string): DrawingRow | undefined =>
      all(q.selectFrom("drawings").selectAll().where("version_id", "=", versionId).where("id", "=", id))[0],
    /** A model's versions, newest (highest number) first. */
    versionsOfModel: (modelId: string): VersionRow[] => all(q.selectFrom("versions").selectAll().where("model_id", "=", modelId).orderBy("number", "desc")),
    /** Records that the customer viewed this version now (only the last time is kept). */
    setVersionSeen: (versionId: string, at: string) =>
      void run(
        q
          .insertInto("version_views")
          .values({ version_id: versionId, seen_at: at })
          .onConflict((oc) => oc.column("version_id").doUpdateSet({ seen_at: at })),
      ),
    /** When the customer last viewed each of these versions (those never viewed are missing). */
    versionsSeen: (versionIds: string[]): { version_id: string; seen_at: string }[] =>
      versionIds.length === 0 ? [] : all(q.selectFrom("version_views").selectAll().where("version_id", "in", versionIds)),
    /** The drawings of these versions, in their order. */
    drawingsOfVersions: (versionIds: string[]): DrawingRow[] =>
      versionIds.length === 0 ? [] : all(q.selectFrom("drawings").selectAll().where("version_id", "in", versionIds).orderBy("position")),
  };
}
