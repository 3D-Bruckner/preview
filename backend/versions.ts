// Versions: a model's numbered uploads, each with its drawings and when the customer last viewed it. Writing them is backend/files.ts.
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
  /** When the customer last viewed it (backend/views.ts); null: never. */
  seenAt: string | null;
} & VersionFigures;

/** A model's versions, newest first. */
export function listVersions(rt: Runtime, modelId: string): Outcome<Version[]> {
  if (!rt.store.model(modelId)) return notFound(`No model ${modelId}.`);
  const rows = rt.store.versionsOfModel(modelId);
  const drawings = rt.store.drawingsOfVersions(rows.map((v) => v.id));
  const jobs = new Map(rt.store.sliceJobsOf(rows.map((v) => v.id)).map((j) => [j.version_id, j]));
  const seen = new Map(rt.store.versionsSeen(rows.map((v) => v.id)).map((s) => [s.version_id, s.seen_at]));
  return ok(
    rows.map((v) => ({
      id: v.id,
      modelId: v.model_id,
      number: v.number,
      note: v.note,
      createdAt: v.created_at,
      parts: factsOf(v)?.parts.length ?? null,
      drawings: drawings.filter((d) => d.version_id === v.id).map((d) => ({ id: d.id, kind: d.kind })),
      seenAt: seen.get(v.id) ?? null,
      ...figuresOf(rt, v, jobs.get(v.id)),
    })),
  );
}
