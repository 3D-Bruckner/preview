import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer } from "./customers";
import { createModel, getModel, listModels, updateModel } from "./models";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";

let rt: TestRuntime;
beforeEach(() => {
  rt = testRuntime();
});
afterEach(() => rt.store.close());

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

describe("models", () => {
  it("refuses a model for an unknown customer or without a title", () => {
    expect(createModel(rt, { customerId: "nope", title: "Vase" })).toMatchObject({ ok: false, reason: "not_found" });
    const c = value(createCustomer(rt, { name: "A" }));
    expect(createModel(rt, { customerId: c.id, title: " " })).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("creates, gets and updates one", () => {
    const c = value(createCustomer(rt, { name: "A" }));
    const m = value(createModel(rt, { customerId: c.id, title: " Vase ", description: "tall" }));
    expect(m).toMatchObject({ customerId: c.id, title: "Vase", description: "tall" });
    expect(value(getModel(rt, m.id))).toEqual(m);
    const u = value(updateModel(rt, m.id, { title: "Bowl" }));
    expect(u).toMatchObject({ title: "Bowl", description: "tall" });
    expect(updateModel(rt, m.id, { title: "" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(updateModel(rt, "nope", {})).toMatchObject({ ok: false, reason: "not_found" });
    expect(getModel(rt, "nope")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("lists only the given customer's models", () => {
    const a = value(createCustomer(rt, { name: "A" }));
    const b = value(createCustomer(rt, { name: "B" }));
    value(createModel(rt, { customerId: a.id, title: "One" }));
    value(createModel(rt, { customerId: b.id, title: "Two" }));
    expect(listModels(rt, { customerId: a.id }).map((m) => m.title)).toEqual(["One"]);
    expect(
      listModels(rt, {})
        .map((m) => m.title)
        .sort(),
    ).toEqual(["One", "Two"]);
  });
});
