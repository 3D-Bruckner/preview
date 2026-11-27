// Versions: a model's numbered uploads, each with its drawings. Writing them comes with the upload (a later task); this is the read.
import { notFound, ok, type Outcome } from "./outcome";
import type { Runtime } from "./runtime";

export type Version = {
  id: string;
  modelId: string;
  number: number;
  note: string | null;
  createdAt: string;
  drawings: { id: string; kind: "png" | "svg" | "pdf" }[];
};

/** A model's versions, newest first. */
export function listVersions(rt: Runtime, modelId: string): Outcome<Version[]> {
  if (!rt.store.model(modelId)) return notFound(`No model ${modelId}.`);
  const rows = rt.store.versionsOfModel(modelId);
  const drawings = rt.store.drawingsOfVersions(rows.map((v) => v.id));
  return ok(
    rows.map((v) => ({
      id: v.id,
      modelId: v.model_id,
      number: v.number,
      note: v.note,
      createdAt: v.created_at,
      drawings: drawings.filter((d) => d.version_id === v.id).map((d) => ({ id: d.id, kind: d.kind })),
    })),
  );
}
