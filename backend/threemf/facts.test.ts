import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8, strToU8, unzipSync, Zip, ZipDeflate, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { FactsError, readFacts } from "./index";

const bytes = (name: string) => new Uint8Array(readFileSync(join(import.meta.dirname, "..", "fixtures", name)));
const SPOOLBUDDY = "/root/3D-Bruckner/bambuddy-wiki/docs/assets/3d-models/SpoolBuddy.3mf";

/** plates.3mf with some entries replaced. */
function platesWith(change: (entries: Record<string, Uint8Array>) => void): Uint8Array {
  const entries = unzipSync(bytes("plates.3mf"));
  change(entries);
  return zipSync(entries);
}

/** A zip whose root model is `size` bytes of zeros, made in 1 MiB pieces so the test never holds it whole. */
function zerosZip(size: number): Uint8Array {
  const parts: Uint8Array[] = [];
  const zip = new Zip((err, chunk) => {
    if (err) throw err;
    parts.push(chunk);
  });
  const entry = new ZipDeflate("3D/3dmodel.model", { level: 1 });
  zip.add(entry);
  const piece = new Uint8Array(1 << 20);
  for (let left = size; left > 0; left -= piece.length) entry.push(left > piece.length ? piece : piece.subarray(0, left), left <= piece.length);
  zip.end();
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("readFacts", () => {
  it("reads a Bambu project's parts split by filament, and its slots", () => {
    expect(readFacts(bytes("plates.3mf"))).toEqual({
      reader: 2,
      unit: 1,
      items: ["2", "4"],
      slots: [
        { slot: 1, type: "PLA", color: "#00ae42" },
        { slot: 2, type: "PETG", color: "#ffffff" },
      ],
      parts: [
        { key: "2:0", name: "Halter", object: "2", components: [0], slot: 1 },
        { key: "4:0", name: "Spule", object: "4", components: [0], slot: 2 },
        { key: "4:1", name: "Spule", object: "4", components: [1], slot: 1 },
      ],
      figures: {
        seconds: 5400,
        grams: 29.75,
        filaments: [
          { slot: 1, type: "PLA", color: "#00ae42", grams: 23.75 },
          { slot: 2, type: "PETG", color: "#ffffff", grams: 6 },
        ],
      },
    });
  });

  it("has no figures for a file nobody sliced", () => {
    expect(readFacts(bytes("ramp.3mf")).figures).toBeNull();
    expect(readFacts(bytes("keychain.3mf")).figures).toBeNull();
  });

  it("has no figures when slice_info.config holds plates without a time or a weight", () => {
    const f = readFacts(
      platesWith((e) => {
        e["Metadata/slice_info.config"] = strToU8('<?xml version="1.0"?><config><plate><metadata key="index" value="1"/></plate></config>');
      }),
    );
    expect(f.figures).toBeNull();
  });

  it("sums the plates that were sliced and leaves out a filament line without grams", () => {
    const f = readFacts(
      platesWith((e) => {
        e["Metadata/slice_info.config"] = strToU8(
          '<config><plate><metadata key="prediction" value="61"/><metadata key="weight" value="1.5"/><filament id="2" type="PLA" color="#FF0000" used_g="1.5"/><filament id="1" type="PLA" color="#000000" used_g="0.00"/></plate><plate><metadata key="index" value="2"/></plate></config>',
        );
      }),
    );
    expect(f.figures).toEqual({ seconds: 61, grams: 1.5, filaments: [{ slot: 2, type: "PLA", color: "#ff0000", grams: 1.5 }] });
  });

  it("reads the README's show project: four mesh objects, each on its own extruder", () => {
    const f = readFacts(bytes("showcase.3mf"));
    expect(f.parts.map((p) => [p.key, p.name, p.slot])).toEqual([
      ["1:0", "Ablage", 1],
      ["2:0", "Stiftehalter", 2],
      ["3:0", "Kartenhalter", 3],
      ["4:0", "Clip", 2],
    ]);
    expect(f.slots.map((s) => s.color)).toEqual(["#1d1e21", "#00ae42", "#f7f7f5"]);
  });

  it("lists an object placed twice once", () => {
    const f = readFacts(
      platesWith((e) => {
        const s = strFromU8(e["3D/3dmodel.model"]!);
        e["3D/3dmodel.model"] = strToU8(s.replace("</build>", '<item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 50 0"/></build>'));
      }),
    );
    expect(f.items).toEqual(["2", "4", "2"]);
    expect(f.parts.map((p) => p.key)).toEqual(["2:0", "4:0", "4:1"]);
  });

  it("reads a plain 3MF as a part per object, slots from its base materials", () => {
    expect(readFacts(bytes("keychain.3mf"))).toMatchObject({
      items: ["1", "2"],
      slots: [
        { slot: 1, type: null, color: "#d62828" },
        { slot: 2, type: null, color: "#1d4ed8" },
      ],
      parts: [
        { key: "1:0", slot: 1, components: null },
        { key: "2:0", slot: 2, components: null },
      ],
    });
  });

  it("gives a colourless file one colourless slot", () => {
    expect(readFacts(bytes("ramp.3mf"))).toEqual({
      reader: 2,
      figures: null,
      unit: 1,
      slots: [{ slot: 1, type: null, color: null }],
      items: ["1"],
      parts: [{ key: "1:0", name: null, object: "1", components: null, slot: 1 }],
    });
  });

  it("takes a plain object's colour from its first triangle when the object names none", () => {
    const model = `<?xml version="1.0"?><model unit="centimeter"><resources><colorgroup id="5"><color color="#112233"/><color color="#445566FF"/></colorgroup><object id="1" type="model"><mesh><vertices/><triangles><triangle v1="0" v2="1" v3="2" pid="5" p1="1"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
    const f = readFacts(zipSync({ "3D/3dmodel.model": strToU8(model) }));
    expect(f.unit).toBe(10);
    expect(f.slots).toEqual([{ slot: 1, type: null, color: "#445566" }]);
    expect(f.parts[0]).toMatchObject({ slot: 1 });
  });

  it.skipIf(!existsSync(SPOOLBUDDY))("reads the SpoolBuddy reference: 10 objects, object 38 in 3 parts", () => {
    const f = readFacts(new Uint8Array(readFileSync(SPOOLBUDDY)));
    expect(f.items).toHaveLength(10);
    expect(f.slots.map((s) => s.color)).toEqual(["#000000", "#ffffff", "#00ae42"]);
    const holder = f.parts.filter((p) => p.object === "38");
    expect(holder.map((p) => p.slot)).toEqual([1, 3, 2]);
    expect(holder.map((p) => p.key)).toEqual(["38:0", "38:1", "38:2"]);
    expect(holder.flatMap((p) => p.components ?? []).sort((a, b) => a - b)).toEqual([...Array(holder.flatMap((p) => p.components ?? []).length).keys()]);
  });

  it("scans a huge plain root model as a stream, within 100 MB of memory", { timeout: 30_000 }, () => {
    const bomb = zipSync({ "3D/3dmodel.model": new Uint8Array(300 * 1024 * 1024) }, { level: 9 });
    const before = process.memoryUsage().arrayBuffers;
    const f = readFacts(bomb);
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(100 * 1024 * 1024);
    expect(f.parts).toEqual([]);
  });

  it("refuses a root model beyond 1 GiB inflated", { timeout: 60_000 }, () => {
    const big = zerosZip(1.1 * 1024 * 1024 * 1024);
    const thrown = (() => {
      try {
        readFacts(big);
      } catch (e) {
        return e;
      }
    })();
    expect(thrown).toBeInstanceOf(FactsError);
    expect((thrown as Error).message).toBe("threemf: too large inside");
  });

  it("refuses a zip without a root model", () => {
    expect(() => readFacts(bytes("not-a-3mf.3mf"))).toThrow(FactsError);
  });

  it("falls back when project_settings.config is not JSON", () => {
    const f = readFacts(platesWith((e) => (e["Metadata/project_settings.config"] = strToU8("not json"))));
    expect(f.slots).toEqual([{ slot: 1, type: null, color: null }]);
    expect(f.parts.find((p) => p.key === "2:0")?.slot).toBe(1);
    expect(f.parts.find((p) => p.key === "4:0")?.slot).toBeNull();
  });

  it("gives a part on an extruder beyond the slots no slot", () => {
    const f = readFacts(
      platesWith((e) => {
        const s = strFromU8(e["Metadata/model_settings.config"]!);
        e["Metadata/model_settings.config"] = strToU8(s.replace('<metadata key="extruder" value="2"/>', '<metadata key="extruder" value="5"/>'));
      }),
    );
    expect(f.parts.find((p) => p.key === "4:0")).toMatchObject({ slot: null, components: [0] });
  });
});
