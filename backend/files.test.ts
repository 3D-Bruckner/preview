import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer } from "./customers";
import { addVersion, versionFile } from "./files";
import { createModel } from "./models";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";
import { listVersions } from "./versions";

const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });
/** A file made for one test: an upload is a file of the kit's temporary folder, which a copy of a fixture stands in for. */
function upload(rt: TestRuntime, name: string, content: Buffer | string) {
  const path = join(mkdtempSync(join(rt.config.dataDir, "up-")), name);
  writeFileSync(path, content);
  return { path };
}

let rt: TestRuntime;
let modelId: string;
beforeEach(() => {
  rt = testRuntime();
  const c = value(createCustomer(rt, { name: "A" }));
  modelId = value(createModel(rt, { customerId: c.id, title: "Vase" })).id;
});
afterEach(() => rt.store.close());

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

const filesDir = () => join(rt.config.dataDir, "files");
const stored = () => (existsSync(filesDir()) ? readdirSync(filesDir(), { recursive: true }) : []);

describe("addVersion", () => {
  it("stores version 1, then version 2, with their files on disk", async () => {
    const v1 = value(await addVersion(rt, modelId, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [], note: " first " }));
    expect(v1).toMatchObject({ modelId, number: 1, note: "first", drawings: [] });
    const f1 = value(versionFile(rt, v1.id, "3mf"));
    expect(f1.type).toBe("model/3mf");
    expect(f1.path.startsWith(join(filesDir(), modelId, v1.id))).toBe(true);
    expect(existsSync(f1.path)).toBe(true);
    expect(value(versionFile(rt, v1.id, "preview"))).toMatchObject({ type: "image/png" });

    const v2 = value(await addVersion(rt, modelId, { threemf: fixture("keychain.3mf"), preview: fixture("preview.png"), drawings: [] }));
    expect(v2.number).toBe(2);
    expect(value(listVersions(rt, modelId)).map((v) => v.number)).toEqual([2, 1]);
  });

  it("stores drawings by their content, in order, and serves them", async () => {
    const svg = upload(rt, "d.svg", `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>`);
    const pdf = upload(rt, "d.pdf", "%PDF-1.4\n");
    const v = value(
      await addVersion(rt, modelId, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [svg, fixture("preview.png"), pdf] }),
    );
    expect(v.drawings.map((d) => d.kind)).toEqual(["svg", "png", "pdf"]);
    expect(value(versionFile(rt, v.id, { drawing: v.drawings[2]!.id }))).toMatchObject({ type: "application/pdf" });
    expect(versionFile(rt, v.id, { drawing: "nope" })).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("refuses a file that is no 3MF, leaving no row and no folder", async () => {
    const r = await addVersion(rt, modelId, { threemf: fixture("not-a-3mf.3mf"), preview: fixture("preview.png"), drawings: [] });
    expect(r).toMatchObject({ ok: false, reason: "invalid", message: expect.stringContaining("not a 3MF") });
    expect(value(listVersions(rt, modelId))).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("refuses bytes that are no zip at all", async () => {
    expect(await addVersion(rt, modelId, { threemf: upload(rt, "x.3mf", "plain"), preview: fixture("preview.png"), drawings: [] })).toMatchObject({
      reason: "invalid",
    });
  });

  it("refuses a preview that is no PNG", async () => {
    const r = await addVersion(rt, modelId, { threemf: fixture("ramp.3mf"), preview: upload(rt, "p.png", "GIF89a"), drawings: [] });
    expect(r).toMatchObject({ ok: false, reason: "invalid", message: expect.stringContaining("preview") });
    expect(stored()).toEqual([]);
  });

  it("refuses a drawing that is an executable, whatever its name says", async () => {
    const r = await addVersion(rt, modelId, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [upload(rt, "evil.exe", "MZ\u0090")] });
    expect(r).toMatchObject({ ok: false, reason: "invalid", message: expect.stringContaining("drawings[0]") });
    expect(value(listVersions(rt, modelId))).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("says not_found for an unknown model", async () => {
    expect(await addVersion(rt, "nope", { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [] })).toMatchObject({
      ok: false,
      reason: "not_found",
    });
  });

  it("removes the version's folder when a failure comes after the files moved", async () => {
    // The files are in place when the second insert fails: the version's folder (not the model's, which other versions use) must go.
    const orig = rt.store.insertDrawing;
    rt.store.insertDrawing = () => {
      throw new Error("disk full");
    };
    const png = fixture("preview.png");
    await expect(addVersion(rt, modelId, { threemf: fixture("ramp.3mf"), preview: png, drawings: [png] })).rejects.toThrow("disk full");
    rt.store.insertDrawing = orig;
    expect(value(listVersions(rt, modelId))).toEqual([]);
    expect(stored().filter((p) => String(p).includes("."))).toEqual([]);
    expect(readdirSync(join(filesDir(), modelId))).toEqual([]);
  });
});

describe("versionFile", () => {
  it("says not_found for an unknown version", () => {
    expect(versionFile(rt, "nope", "3mf")).toMatchObject({ ok: false, reason: "not_found" });
  });
});
