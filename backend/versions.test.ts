import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer } from "./customers";
import { createModel } from "./models";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";
import { listVersions } from "./versions";

let rt: TestRuntime;
beforeEach(() => {
  rt = testRuntime();
});
afterEach(() => rt.store.close());

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

describe("listVersions", () => {
  it("says not_found for an unknown model", () => {
    expect(listVersions(rt, "nope")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("lists a model's versions newest first, with their drawings", () => {
    const c = value(createCustomer(rt, { name: "A" }));
    const m = value(createModel(rt, { customerId: c.id, title: "Vase" }));
    expect(value(listVersions(rt, m.id))).toEqual([]);
    for (const number of [1, 2]) {
      rt.store.insertVersion({
        id: `v${number}`,
        model_id: m.id,
        number,
        note: number === 2 ? "thicker" : null,
        threemf_file: `v${number}.3mf`,
        preview_file: `v${number}.png`,
        created_at: rt.clock().toISOString(),
      });
    }
    rt.store.insertDrawing({ id: "d1", version_id: "v2", file: "d1.svg", kind: "svg", position: 0 });
    const list = value(listVersions(rt, m.id));
    expect(list.map((v) => v.number)).toEqual([2, 1]);
    expect(list[0]).toMatchObject({ id: "v2", modelId: m.id, note: "thicker", drawings: [{ id: "d1", kind: "svg" }] });
    expect(list[1]!.drawings).toEqual([]);
  });
});
