import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer, getCustomer, type Customer } from "./customers";
import { addVersion } from "./files";
import { createModel, type Model } from "./models";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";
import { listVersions, type Version } from "./versions";
import { modelSeenAt, recordView } from "./views";

const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

let rt: TestRuntime;
let a: Customer;
let b: Customer;
let ramp: Model;
let v1: Version;
let v2: Version;
let bVersion: Version;

beforeEach(async () => {
  rt = testRuntime();
  a = value(createCustomer(rt, { name: "Anna" }));
  b = value(createCustomer(rt, { name: "Bert" }));
  ramp = value(createModel(rt, { customerId: a.id, title: "Ramp" }));
  v1 = value(await addVersion(rt, ramp.id, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [] }));
  v2 = value(await addVersion(rt, ramp.id, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [] }));
  const bModel = value(createModel(rt, { customerId: b.id, title: "Keychain" }));
  bVersion = value(await addVersion(rt, bModel.id, { threemf: fixture("keychain.3mf"), preview: fixture("preview.png"), drawings: [] }));
});
afterEach(() => rt.store.close());

describe("recordView", () => {
  it("starts with nothing seen", () => {
    expect(value(getCustomer(rt, a.id)).lastSeenAt).toBeNull();
    expect(value(listVersions(rt, ramp.id)).map((v) => v.seenAt)).toEqual([null, null]);
    expect(modelSeenAt(rt, ramp.id)).toBeNull();
  });

  it("records the customer's page and the version they viewed, by their token", () => {
    expect(recordView(rt, a.link!)).toBe(true);
    const seen = value(getCustomer(rt, a.id)).lastSeenAt;
    expect(seen).not.toBeNull();
    expect(value(listVersions(rt, ramp.id)).map((v) => v.seenAt)).toEqual([null, null]);

    expect(recordView(rt, a.link!, v1.id)).toBe(true);
    const versions = value(listVersions(rt, ramp.id));
    expect(versions.find((v) => v.id === v1.id)!.seenAt).not.toBeNull();
    expect(versions.find((v) => v.id === v2.id)!.seenAt).toBeNull();
    expect(modelSeenAt(rt, ramp.id)).toBe(versions.find((v) => v.id === v1.id)!.seenAt);
  });

  it("records nothing for an unknown token or another customer's version", () => {
    expect(recordView(rt, "nope")).toBe(false);
    expect(recordView(rt, a.link!, bVersion.id)).toBe(false);
    expect(recordView(rt, a.link!, "00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(value(getCustomer(rt, a.id)).lastSeenAt).toBeNull();
    expect(value(listVersions(rt, bVersion.modelId)).map((v) => v.seenAt)).toEqual([null]);
  });
});
