// A version's files: the 3MF, its preview picture and its drawings, kept as uploaded under DATA_DIR/files/<modelId>/<versionId>/
// (model.3mf, preview.png, <drawingId>.<png|svg|pdf>); the rows hold those names. What a file is goes by what is inside it, not by its
// name or the type its sender declared. An upload is all or nothing: a refusal before anything is written leaves no folder, and a failure
// after the files moved removes the version's folder, so neither a row nor a file stays.
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { invalid, notFound, ok, type Outcome } from "./outcome";
import { mutation, type Runtime } from "./runtime";
import type { Version } from "./versions";

/** A file of an upload, waiting where `readMultipart` put it (next-app-kit's ReceivedFile has more, and fits). */
export type UploadedFile = { path: string };

/** What `readMultipart` accepts for a version: the 3MF, the preview and the drawings. The OpenSCAD source is never one of them. */
export const UPLOAD_TYPES = [".3mf", ".png", ".svg", ".pdf"];

const TYPES = { "3mf": "model/3mf", png: "image/png", svg: "image/svg+xml", pdf: "application/pdf" } as const;
type DrawingKind = "png" | "svg" | "pdf";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isPng = (b: Buffer) => b.length > PNG.length && b.subarray(0, PNG.length).equals(PNG);
const isPdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-";
/** An SVG's root element: after an optional BOM, XML declaration, comments and doctype, the first element is <svg. */
const isSvg = (b: Buffer) => /^﻿?\s*(<\?xml[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(b.subarray(0, 4096).toString("utf8"));

/** A 3MF is a zip with 3D/3dmodel.model. Decided from the central directory alone: the filter sees the entry's name and returns false, so
 * nothing is ever inflated (an entry's declared size is the sender's, and a few KB can inflate to gigabytes). */
function isThreeMf(b: Buffer): boolean {
  let found = false;
  try {
    unzipSync(b, {
      filter: (f) => {
        if (f.name === "3D/3dmodel.model") found = true;
        return false;
      },
    });
  } catch {
    return false;
  }
  return found;
}

function drawingKind(b: Buffer): DrawingKind | null {
  return isPng(b) ? "png" : isPdf(b) ? "pdf" : isSvg(b) ? "svg" : null;
}

const versionDir = (rt: Runtime, modelId: string, versionId: string): string => join(rt.config.dataDir, "files", modelId, versionId);

/** Adds the next version of a model (max + 1) with its files; refused wholly when any file is not what it should be. */
export async function addVersion(
  rt: Runtime,
  modelId: string,
  input: { threemf: UploadedFile; preview: UploadedFile; drawings: UploadedFile[]; note?: string },
): Promise<Outcome<Version>> {
  if (!rt.store.model(modelId)) return notFound(`No model ${modelId}.`);
  const threemf = readFileSync(input.threemf.path);
  if (!isThreeMf(threemf)) return invalid("threemf: not a 3MF (a zip with 3D/3dmodel.model)");
  const preview = readFileSync(input.preview.path);
  if (!isPng(preview)) return invalid("preview: not a PNG");
  const drawings: { id: string; kind: DrawingKind; path: string }[] = [];
  for (const [i, d] of input.drawings.entries()) {
    const bytes = readFileSync(d.path);
    const kind = drawingKind(bytes);
    if (!kind) return invalid(`drawings[${i}]: not a PNG, SVG or PDF`);
    drawings.push({ id: randomUUID(), kind, path: d.path });
  }

  const id = randomUUID();
  const dir = versionDir(rt, modelId, id);
  let stored = false;
  try {
    mkdirSync(dir, { recursive: true });
    copyFileSync(input.threemf.path, join(dir, "model.3mf"));
    copyFileSync(input.preview.path, join(dir, "preview.png"));
    for (const d of drawings) copyFileSync(d.path, join(dir, `${d.id}.${d.kind}`));
    const out = mutation(rt, (): Outcome<Version> => {
      if (!rt.store.model(modelId)) return notFound(`No model ${modelId}.`);
      const number = (rt.store.maxVersionNumber(modelId) ?? 0) + 1;
      const now = rt.clock().toISOString();
      const note = input.note?.trim() || null;
      rt.store.insertVersion({ id, model_id: modelId, number, note, threemf_file: "model.3mf", preview_file: "preview.png", created_at: now });
      drawings.forEach((d, position) => rt.store.insertDrawing({ id: d.id, version_id: id, file: `${d.id}.${d.kind}`, kind: d.kind, position: position + 1 }));
      return ok({ id, modelId, number, note, createdAt: now, drawings: drawings.map((d) => ({ id: d.id, kind: d.kind })) });
    });
    stored = out.ok;
    return out;
  } finally {
    if (!stored) rmSync(dir, { recursive: true, force: true });
  }
}

/** Where a version's file is stored and its content type; not_found when the version, the drawing or the file is not there. */
export function versionFile(rt: Runtime, versionId: string, kind: "3mf" | "preview" | { drawing: string }): Outcome<{ path: string; type: string }> {
  const version = rt.store.version(versionId);
  if (!version) return notFound(`No version ${versionId}.`);
  let name: string;
  let type: string;
  if (kind === "3mf") [name, type] = [version.threemf_file, TYPES["3mf"]];
  else if (kind === "preview") [name, type] = [version.preview_file, TYPES.png];
  else {
    const d = rt.store.drawing(versionId, kind.drawing);
    if (!d) return notFound(`No drawing ${kind.drawing} on version ${versionId}.`);
    [name, type] = [d.file, TYPES[d.kind]];
  }
  const path = join(versionDir(rt, version.model_id, version.id), name);
  return existsSync(path) ? ok({ path, type }) : notFound("The file is not on disk.");
}
