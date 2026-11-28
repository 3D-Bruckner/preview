// Versions: a model's numbered uploads, each with its drawings. Writing them comes with the upload (a later task); this is the read.
import { factsOf } from "./facts";
import { figuresOf, type VersionFigures } from "./figures";
import { notFound, ok, type Outcome } from "./outcome";
import type { Runtime } from "./runtime";

export type Version = {
  id: string;
  modelId: string;
  number: number;
  note: string | null;
  createdAt: string;
  /** How many parts its 3MF has; null until its facts are read. */
  parts: number | null;
  drawings: { id: string; kind: "png" | "svg" | "pdf" }[];
} & VersionFigures;

/** A model's versions, newest first. */
export function listVersions(rt: Runtime, modelId: string): Outcome<Version[]> {
  if (!rt.store.model(modelId)) return notFound(`No model ${modelId}.`);
  const rows = rt.store.versionsOfModel(modelId);
  const drawings = rt.store.drawingsOfVersions(rows.map((v) => v.id));
  const jobs = new Map(rt.store.sliceJobsOf(rows.map((v) => v.id)).map((j) => [j.version_id, j]));
  return ok(
    rows.map((v) => ({
      id: v.id,
      modelId: v.model_id,
      number: v.number,
      note: v.note,
      createdAt: v.created_at,
      parts: factsOf(v)?.parts.length ?? null,
      drawings: drawings.filter((d) => d.version_id === v.id).map((d) => ({ id: d.id, kind: d.kind })),
      ...figuresOf(rt, v, jobs.get(v.id)),
    })),
  );
}
