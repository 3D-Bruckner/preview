// The queries on slice_jobs: the slicing service's work per version (backend/slicer.ts).
import type { Exec } from "./connection";
import type { SliceJobRow } from "./schema";

export function sliceJobQueries({ q, all, run }: Exec) {
  return {
    sliceJob: (versionId: string): SliceJobRow | undefined => all(q.selectFrom("slice_jobs").selectAll().where("version_id", "=", versionId))[0],
    sliceJobsOf: (versionIds: string[]): SliceJobRow[] =>
      versionIds.length === 0 ? [] : all(q.selectFrom("slice_jobs").selectAll().where("version_id", "in", versionIds)),
    /** Every version that has a job, whatever its state. */
    sliceJobIds: (): string[] => all(q.selectFrom("slice_jobs").select("version_id")).map((r) => r.version_id),
    /** The pending job due first at `now`, if any. */
    dueSliceJob: (now: string): SliceJobRow | undefined =>
      all(q.selectFrom("slice_jobs").selectAll().where("state", "=", "pending").where("next_at", "<=", now).orderBy("next_at").limit(1))[0],
    /** A new pending job, or the version's job made pending again from its start (Neu berechnen). */
    putSliceJob: (versionId: string, now: string) =>
      void run(
        q
          .insertInto("slice_jobs")
          .values({ version_id: versionId, state: "pending", attempts: 0, next_at: now, reason: null, figures: null, updated_at: now })
          .onConflict((c) => c.column("version_id").doUpdateSet({ state: "pending", attempts: 0, next_at: now, reason: null, figures: null, updated_at: now })),
      ),
    updateSliceJob: (versionId: string, set: Partial<Omit<SliceJobRow, "version_id">>) =>
      void run(q.updateTable("slice_jobs").set(set).where("version_id", "=", versionId)),
  };
}
