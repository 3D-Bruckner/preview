import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer, createModel, listVersions, revokeLink, type Customer, type Model } from "@/backend";
import { testRuntime, type TestRuntime } from "@/backend/testing/runtime";
import { uploadVersion } from "./upload";

const fixture = (name: string) => readFileSync(join(process.cwd(), "backend", "fixtures", name));
const OWNER = { id: "u1", email: "owner@example.com" };

let rt: TestRuntime;
let customer: Customer;
let model: Model;
beforeEach(() => {
  rt = testRuntime();
  rt.person = async () => OWNER;
  const c = createCustomer(rt, { name: "Kunde" });
  const m = c.ok && createModel(rt, { customerId: c.value.id, title: "Vase" });
  if (!c.ok || !m || !m.ok) throw new Error("setup");
  customer = c.value;
  model = m.value;
});
afterEach(() => rt.store.close());

type Part = [field: string, content: Blob | string, name?: string];
const model3mf: Part = ["model", new Blob([fixture("ramp.3mf")]), "ramp.3mf"];
const previewPng: Part = ["preview", new Blob([fixture("preview.png")]), "preview.png"];

/** The multipart post a script's curl sends, with German or English asked for by Accept-Language. */
async function post(parts: Part[], lang = "de"): Promise<Request> {
  const fd = new FormData();
  for (const [field, content, name] of parts) {
    if (typeof content === "string") fd.append(field, content);
    else fd.append(field, content, name);
  }
  const encoded = new Response(fd);
  return new Request("http://localhost/api/models/x/versions", {
    method: "POST",
    body: await encoded.arrayBuffer(),
    headers: { "content-type": encoded.headers.get("content-type")!, "accept-language": lang },
  });
}

const answer = async (r: Response) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> });
const send = async (parts: Part[], lang = "de", id = model.id) => answer(await uploadVersion(rt, await post(parts, lang), id));
const storedFiles = () => {
  const dir = join(rt.config.dataDir, "files");
  return existsSync(dir) ? readdirSync(dir, { recursive: true }) : [];
};

describe("POST /api/models/[id]/versions", () => {
  it("stores the version with its drawings and note, and answers 201 with the link to the customer's page", async () => {
    const drawing: Part = ["drawing", new Blob([fixture("preview.png")]), "d.png"];
    const { status, body } = await send([model3mf, previewPng, drawing, drawing, ["note", " Neue Wand "]]);
    expect(status).toBe(201);
    expect(body).toEqual({ id: expect.any(String), number: 1, note: "Neue Wand", link: `https://preview.example.com/k/${customer.link}/${model.id}` });
    const stored = listVersions(rt, model.id);
    expect(stored.ok && stored.value[0]?.drawings).toHaveLength(2);
    expect((await send([model3mf, previewPng])).body).toMatchObject({ number: 2, note: null });
  });

  it("answers link null once the customer's link is revoked", async () => {
    revokeLink(rt, customer.id);
    expect((await send([model3mf, previewPng])).body).toMatchObject({ number: 1, link: null });
  });

  it("answers 401 to someone not signed in, storing nothing", async () => {
    rt.person = async () => null;
    expect(await send([model3mf, previewPng])).toEqual({ status: 401, body: { error: "Bitte zuerst anmelden." } });
    expect(storedFiles()).toEqual([]);
  });

  it("tokenWithWriteUploads: an API token that may write uploads; a read token gets 403", async () => {
    rt.person = async () => null;
    rt.apiCaller = async () => ({ person: "u1", actor: "script", scope: "read+write", kind: "token" });
    expect((await send([model3mf, previewPng])).status).toBe(201);
    rt.apiCaller = async () => ({ person: "u1", actor: "script", scope: "read", kind: "token" });
    expect(await send([model3mf, previewPng], "en")).toEqual({ status: 403, body: { error: "This token may only read" } });
    expect(listVersions(rt, model.id)).toMatchObject({ ok: true, value: [{ number: 1 }] });
  });

  it("answers 404 for a model that doesn't exist", async () => {
    expect(await send([model3mf, previewPng], "de", "nope")).toEqual({ status: 404, body: { error: "Dieses Modell gibt es nicht (mehr)." } });
  });

  it("answers 400 for a missing or doubled model or preview, in the page's language", async () => {
    expect((await send([previewPng], "en")).body).toEqual({ error: "The upload needs one 3MF file in the field “model”." });
    expect((await send([model3mf, model3mf, previewPng])).status).toBe(400);
    expect((await send([model3mf], "en")).body).toEqual({ error: "This 3MF has no picture of its own: the upload needs one PNG in the field “preview”." });
    expect((await send([model3mf, previewPng, previewPng])).status).toBe(400);
    expect((await send([model3mf, previewPng, ["other", new Blob([fixture("preview.png")]), "x.png"]])).status).toBe(400);
    expect(storedFiles()).toEqual([]);
  });

  it("takes the 3MF's own picture when no preview is sent", async () => {
    const plates: Part = ["model", new Blob([fixture("plates.3mf")]), "plates.3mf"];
    expect((await send([plates])).status).toBe(201);
  });

  it("answers 400 for more than 10 drawings", async () => {
    const drawing: Part = ["drawing", new Blob([fixture("preview.png")]), "d.png"];
    expect((await send([model3mf, previewPng, ...Array<Part>(11).fill(drawing)])).body).toEqual({ error: "Höchstens 10 Zeichnungen pro Version." });
    expect((await send([model3mf, previewPng, ...Array<Part>(10).fill(drawing)])).status).toBe(201);
  });

  it("answers 400 for a kind that is not accepted, and for a file that is not what its kind says", async () => {
    expect(await send([["model", new Blob(["x"]), "a.stl"], previewPng], "en")).toEqual({
      status: 400,
      body: { error: "Only a 3MF, a PNG, an SVG or a PDF can be uploaded." },
    });
    const bad = await send([["model", new Blob([fixture("not-a-3mf.3mf")]), "a.3mf"], previewPng]);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("Eine Datei ist nicht");
    expect(storedFiles()).toEqual([]);
  });

  it("answers 413 for a file over PREVIEW_MAX_UPLOAD_MB", async () => {
    rt.config.maxUploadMb = 1;
    const big: Part = ["model", new Blob([new Uint8Array(1024 * 1024 + 1)]), "big.3mf"];
    expect(await send([big, previewPng])).toEqual({ status: 413, body: { error: "Eine Datei ist zu groß." } });
    expect(storedFiles()).toEqual([]);
  });

  it("answers 413 for files that are each under PREVIEW_MAX_UPLOAD_MB but over it together", async () => {
    rt.config.maxUploadMb = 1;
    const half = (field: string, name: string): Part => [field, new Blob([new Uint8Array(600 * 1024)]), name];
    expect(await send([half("model", "a.3mf"), half("preview", "b.png")])).toEqual({ status: 413, body: { error: "Eine Datei ist zu groß." } });
    expect(storedFiles()).toEqual([]);
  });
});
