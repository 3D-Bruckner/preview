import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilament, deleteFilament, filamentName, listFilaments, updateFilament } from "./filaments";
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

describe("filaments", () => {
  it("creates them in order, the colour in lower case, available unless said otherwise", () => {
    const a = value(createFilament(rt, { name: " Bambu Grün ", material: "PLA", color: "#00AE42" }));
    const b = value(createFilament(rt, { name: "Weiß", material: "PETG", color: "#ffffff", available: false }));
    expect(a).toMatchObject({ name: "Bambu Grün", material: "PLA", color: "#00ae42", available: true, position: 1 });
    expect(b).toMatchObject({ available: false, position: 2 });
    expect(listFilaments(rt).map((f) => f.name)).toEqual(["Bambu Grün", "Weiß"]);
    expect(listFilaments(rt, { available: true }).map((f) => f.name)).toEqual(["Bambu Grün"]);
  });

  it("refuses a missing name or material, a too long one, and a colour that isn't #rrggbb", () => {
    for (const input of [
      { name: " ", material: "PLA", color: "#000000" },
      { name: "x".repeat(61), material: "PLA", color: "#000000" },
      { name: "Schwarz", material: "", color: "#000000" },
      { name: "Schwarz", material: "x".repeat(21), color: "#000000" },
      { name: "Schwarz", material: "PLA", color: "black" },
      { name: "Schwarz", material: "PLA", color: "#000" },
    ])
      expect(createFilament(rt, input)).toMatchObject({ ok: false, reason: "invalid" });
    expect(listFilaments(rt)).toEqual([]);
  });

  it("updates only what is given, moves one by its position, and refuses an unknown one", () => {
    const a = value(createFilament(rt, { name: "A", material: "PLA", color: "#111111" }));
    value(createFilament(rt, { name: "B", material: "PLA", color: "#222222" }));
    expect(value(updateFilament(rt, a.id, { available: false, color: "#ABCDEF" }))).toMatchObject({ name: "A", available: false, color: "#abcdef" });
    value(updateFilament(rt, a.id, { position: 3 }));
    expect(listFilaments(rt).map((f) => f.name)).toEqual(["B", "A"]);
    expect(updateFilament(rt, "nope", { name: "C" })).toMatchObject({ ok: false, reason: "not_found" });
    expect(updateFilament(rt, a.id, { color: "rot" })).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("deletes one, and refuses an unknown one", () => {
    const a = value(createFilament(rt, { name: "A", material: "PLA", color: "#111111" }));
    expect(value(deleteFilament(rt, a.id))).toEqual({ id: a.id });
    expect(listFilaments(rt)).toEqual([]);
    expect(deleteFilament(rt, a.id)).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("names a file's filament from the list on an exact colour and material, available or not", () => {
    value(createFilament(rt, { name: "Bambu Grün", material: "PLA", color: "#00AE42", available: false }));
    const list = listFilaments(rt);
    expect(filamentName(list, { type: "PLA", color: "#00ae42" })).toBe("Bambu Grün");
    expect(filamentName(list, { type: "pla", color: "#00AE42" })).toBe("Bambu Grün");
    expect(filamentName(list, { type: "PETG", color: "#00ae42" })).toBeNull();
    expect(filamentName(list, { type: "PLA", color: "#00ae43" })).toBeNull();
    expect(filamentName(list, { type: null, color: "#00ae42" })).toBeNull();
  });
});
