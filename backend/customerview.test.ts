import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer, renewLink, revokeLink, type Customer } from "./customers";
import { customerFile, customerLanguage, customerModel, customerView } from "./customerview";
import { addVersion } from "./files";
import { createModel, type Model } from "./models";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";
import type { Version } from "./versions";

const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

let rt: TestRuntime;
let a: Customer;
let b: Customer;
let ramp: Model;
let bModel: Model;
let v1: Version;
let v2: Version;
let bVersion: Version;

beforeEach(async () => {
  rt = testRuntime();
  a = value(createCustomer(rt, { name: "Anna", language: "en" }));
  b = value(createCustomer(rt, { name: "Bert" }));
  ramp = value(createModel(rt, { customerId: a.id, title: "Ramp", description: "For the step" }));
  v1 = value(await addVersion(rt, ramp.id, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [], note: "first" }));
  v2 = value(
    await addVersion(rt, ramp.id, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [fixture("preview.png")], note: "2 cm wider" }),
  );
  bModel = value(createModel(rt, { customerId: b.id, title: "Keychain" }));
  bVersion = value(await addVersion(rt, bModel.id, { threemf: fixture("keychain.3mf"), preview: fixture("preview.png"), drawings: [] }));
});
afterEach(() => rt.store.close());

const files = (token: string, versionId: string) => `/k/${token}/files/${versionId}`;

describe("customerView", () => {
  it("shows the customer's models with their latest version's preview, and nothing of another customer's", () => {
    value(createModel(rt, { customerId: a.id, title: "Not uploaded yet" }));
    const view = customerView(rt, a.link!)!;
    expect(view.customer).toEqual({ name: "Anna" });
    // A model with no version yet has nothing to show, so it isn't there.
    expect(view.models).toEqual([
      {
        id: ramp.id,
        title: "Ramp",
        description: "For the step",
        latest: { number: 2, createdAt: v2.createdAt, note: "2 cm wider", previewUrl: `${files(a.link!, v2.id)}/preview.png` },
      },
    ]);
  });

  it("is null for an unknown, an empty, a revoked or a replaced token", () => {
    expect(customerView(rt, "x".repeat(32))).toBeNull();
    expect(customerView(rt, "")).toBeNull();
    const old = a.link!;
    value(renewLink(rt, a.id));
    expect(customerView(rt, old)).toBeNull();
    value(revokeLink(rt, b.id));
    expect(customerView(rt, b.link!)).toBeNull();
  });
});

describe("customerModel", () => {
  it("shows the model and its versions, newest first, with their files' addresses", () => {
    const m = customerModel(rt, a.link!, ramp.id)!;
    expect(m.model).toEqual({ id: ramp.id, title: "Ramp", description: "For the step" });
    expect(m.versions.map((v) => [v.number, v.note])).toEqual([
      [2, "2 cm wider"],
      [1, "first"],
    ]);
    const [latest] = m.versions;
    expect(latest).toMatchObject({
      createdAt: v2.createdAt,
      threemfUrl: `${files(a.link!, v2.id)}/model.3mf`,
      previewUrl: `${files(a.link!, v2.id)}/preview.png`,
      drawings: [{ url: `${files(a.link!, v2.id)}/${v2.drawings[0]!.id}.png`, kind: "png" }],
    });
    expect(m.versions[1]!.drawings).toEqual([]);
  });

  it("is null for another customer's model, an unknown model, a model with no version or a token that no longer opens", () => {
    expect(customerModel(rt, a.link!, bModel.id)).toBeNull();
    expect(customerModel(rt, b.link!, ramp.id)).toBeNull();
    expect(customerModel(rt, a.link!, "no-such-model")).toBeNull();
    const empty = value(createModel(rt, { customerId: a.id, title: "Empty" }));
    expect(customerModel(rt, a.link!, empty.id)).toBeNull();
    const old = a.link!;
    value(renewLink(rt, a.id));
    expect(customerModel(rt, old, ramp.id)).toBeNull();
  });
});

describe("customerFile", () => {
  it("finds the token's customer's 3MF, preview and drawings", () => {
    expect(customerFile(rt, a.link!, v1.id, "model.3mf")).toMatchObject({ type: "model/3mf" });
    expect(customerFile(rt, a.link!, v1.id, "preview.png")).toMatchObject({ type: "image/png" });
    expect(customerFile(rt, a.link!, v2.id, `${v2.drawings[0]!.id}.png`)).toMatchObject({ type: "image/png" });
  });

  it("is null for another customer's version, an unknown file, a drawing of another version or under the wrong kind, or a dead token", () => {
    expect(customerFile(rt, a.link!, bVersion.id, "model.3mf")).toBeNull();
    expect(customerFile(rt, b.link!, v1.id, "preview.png")).toBeNull();
    expect(customerFile(rt, a.link!, v1.id, "model.scad")).toBeNull();
    expect(customerFile(rt, a.link!, v1.id, "../../../preview.sqlite")).toBeNull();
    expect(customerFile(rt, a.link!, v1.id, `${v2.drawings[0]!.id}.png`)).toBeNull();
    expect(customerFile(rt, a.link!, v2.id, `${v2.drawings[0]!.id}.svg`)).toBeNull();
    expect(customerFile(rt, a.link!, "no-such-version", "model.3mf")).toBeNull();
    value(revokeLink(rt, a.id));
    expect(customerFile(rt, a.link!, v1.id, "model.3mf")).toBeNull();
  });
});

describe("customerLanguage", () => {
  it("is the language of the token's customer, null for a token that doesn't open", () => {
    expect(customerLanguage(rt, a.link!)).toBe("en");
    expect(customerLanguage(rt, b.link!)).toBe("de");
    expect(customerLanguage(rt, "nope")).toBeNull();
  });
});
