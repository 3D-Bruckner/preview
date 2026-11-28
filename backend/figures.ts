// A version's print figures as every surface answers them: from its own 3MF when Bambu Studio sliced it (facts), else the slicing
// service's answer (slice_jobs), with where the slicing stands while there is none.
import { factsOf } from "./facts";
import { invalid, notFound, ok, type Outcome } from "./outcome";
import type { Runtime } from "./runtime";
import type { FactsFigures } from "./threemf";
import type { SliceJobRow, VersionRow } from "./db";

export type Figures = FactsFigures & {
  /** "file": Bambu Studio's own slice, with the operator's profiles; "slicer": the slicing service's, on its fixed profiles. */
  source: "file" | "slicer";
};

export type VersionFigures = {
  figures: Figures | null;
  /** "pending": the slicer will answer; "failed": it couldn't (`reason`); null: there are figures, or there will be none. */
  slicing: "pending" | "failed" | null;
  reason: string | null;
};

const NONE: VersionFigures = { figures: null, slicing: null, reason: null };

/** The figures of a version row and its slice job (if any). */
export function figuresOf(rt: Runtime, row: Pick<VersionRow, "facts">, job: SliceJobRow | undefined): VersionFigures {
  const facts = factsOf(row);
  if (!facts) return NONE;
  if (facts.figures) return { figures: { source: "file", ...facts.figures }, slicing: null, reason: null };
  if (job?.state === "done" && job.figures) return { figures: { source: "slicer", ...(JSON.parse(job.figures) as FactsFigures) }, slicing: null, reason: null };
  if (job?.state === "failed") return { figures: null, slicing: "failed", reason: job.reason };
  return rt.config.slicer ? { figures: null, slicing: "pending", reason: null } : NONE;
}

/** One version's figures; nothing for a version that doesn't exist. */
export function versionFigures(rt: Runtime, versionId: string): VersionFigures {
  const row = rt.store.version(versionId);
  return row ? figuresOf(rt, row, rt.store.sliceJob(versionId)) : NONE;
}

/** Asks the slicer again for a version without figures of its own (Neu berechnen): its job starts over, now. */
export function resliceVersion(rt: Runtime, versionId: string): Outcome<{ slicing: "pending" }> {
  const row = rt.store.version(versionId);
  if (!row) return notFound(`No version ${versionId}.`);
  if (!rt.config.slicer) return invalid("This instance has no slicer (PREVIEW_SLICER_URL).");
  const facts = factsOf(row);
  if (!facts) return invalid("The version's 3MF hasn't been read yet; read it first (reread_facts).");
  if (facts.figures) return invalid("The version's 3MF has its own figures from Bambu Studio; there is nothing to slice.");
  rt.store.putSliceJob(versionId, rt.clock().toISOString());
  rt.wakeSlicer();
  return ok({ slicing: "pending" });
}
