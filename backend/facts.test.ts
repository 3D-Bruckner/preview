import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer } from "./customers";
import { factsOf, fillMissingFacts, rereadFacts } from "./facts";
import { addVersion } from "./files";
import { createModel } from "./models";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";
import { readFacts } from "./threemf";
import { listVersions } from "./versions";

const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });
const platesFacts = () => readFacts(new Uint8Array(readFileSync(fixture("plates.3mf").path)));

let rt: TestRuntime;
let modelId: string;
beforeEach(() => {
  rt = testRuntime();
  const c = value(createCustomer(rt, { name: "A" }));
  modelId = value(createModel(rt, { customerId: c.id, title: "Spulenhalter" })).id;
});
afterEach(() => rt.store.close());

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

const upload = async (name = "plates.3mf") => value(await addVersion(rt, modelId, { threemf: fixture(name), preview: fixture("preview.png"), drawings: [] }));

describe("a version's facts", () => {
  it("are read at upload and stored with the version, which counts its parts", async () => {
    const v = await upload();
    expect(factsOf(rt.store.version(v.id)!)).toEqual(platesFacts());
    expect(v.parts).toBe(3);
    expect(value(listVersions(rt, modelId))[0]!.parts).toBe(3);
  });

  it("fillMissingFacts reads them for versions stored without (as before they existed), once", async () => {
    const v = await upload();
    rt.store.setFacts(v.id, null);
    expect(factsOf(rt.store.version(v.id)!)).toBeNull();
    expect(value(listVersions(rt, modelId))[0]!.parts).toBeNull();
    expect(fillMissingFacts(rt)).toEqual({ read: 1, failed: 0 });
    expect(factsOf(rt.store.version(v.id)!)).toEqual(platesFacts());
    expect(fillMissingFacts(rt)).toEqual({ read: 0, failed: 0 });
  });

  it("fillMissingFacts reads again what an older reader read", async () => {
    const v = await upload();
    rt.store.setFacts(v.id, JSON.stringify({ ...platesFacts(), reader: 0 }));
    expect(fillMissingFacts(rt)).toEqual({ read: 1, failed: 0 });
    expect(factsOf(rt.store.version(v.id)!)?.reader).toBe(1);
  });

  it("rereadFacts replaces them; not_found for an unknown version", async () => {
    const v = await upload("ramp.3mf");
    rt.store.setFacts(v.id, null);
    expect(rereadFacts(rt, v.id)).toEqual({ ok: true, value: { parts: 1 } });
    expect(rereadFacts(rt, "nope")).toMatchObject({ ok: false, reason: "not_found" });
  });
});
