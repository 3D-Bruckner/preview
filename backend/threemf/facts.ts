// A version's facts from its 3MF: the parts, the filament slots and, when Bambu Studio sliced it, the print figures. A Bambu Studio project (it has Metadata/model_settings.config) says
// per object which filament each of its parts prints in, and lists the slots in Metadata/project_settings.config (JSON); a plain 3MF
// (OpenSCAD and other tools) gives one part per object, coloured by its base material or colour group. Odd metadata falls back to
// what is known and never fails an upload; only a missing or too large root model does.
import { READER, UNIT_MM, type Facts, type FactsFigures, type FactsFilament, type FactsPart, type FactsSlot } from "./types";
import { scanTags, TagStream, type Tag } from "./xml";
import { entries, FactsError, readEntry, scanEntry } from "./zip";

const MiB = 1024 * 1024;
const CONFIG_MAX = 16 * MiB;
const ROOT_MAX = 1024 * MiB;
const ROOT = "3D/3dmodel.model";

type RootObject = { id: string; name: string | null; pid: string | null; pindex: string | null; components: string[]; tri: { pid: string; p: string } | null };
type Root = { unit: number; items: string[]; objects: Map<string, RootObject>; colours: Map<string, (string | null)[]> };

/** `#RRGGBB` or `#RRGGBBAA` as `#rrggbb`; anything else null. */
function colour(value: string | undefined): string | null {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value?.trim() ?? "");
  return m ? `#${m[1]!.toLowerCase()}` : null;
}

function readRoot(bytes: Uint8Array, all: ReturnType<typeof entries>): Root {
  const root: Root = { unit: 1, items: [], objects: new Map(), colours: new Map() };
  let object: RootObject | null = null;
  let group: (string | null)[] | null = null;
  let inBuild = false;
  const onTag = (t: Tag) => {
    const name = t.name.includes(":") ? t.name.slice(t.name.indexOf(":") + 1) : t.name;
    if (t.end) {
      if (name === "object") object = null;
      else if (name === "basematerials" || name === "colorgroup") group = null;
      else if (name === "build") inBuild = false;
      return;
    }
    switch (name) {
      case "model":
        root.unit = UNIT_MM[t.attrs.unit ?? "millimeter"] ?? 1;
        break;
      case "object":
        if (!t.attrs.id) break;
        object = { id: t.attrs.id, name: t.attrs.name || null, pid: t.attrs.pid ?? null, pindex: t.attrs.pindex ?? null, components: [], tri: null };
        root.objects.set(object.id, object);
        if (t.selfClosing) object = null;
        break;
      case "component":
        if (object && t.attrs.objectid) (object as RootObject).components.push(t.attrs.objectid);
        break;
      case "triangle":
        if (object && !(object as RootObject).tri && t.attrs.pid) (object as RootObject).tri = { pid: t.attrs.pid, p: t.attrs.p1 ?? "" };
        break;
      case "basematerials":
      case "colorgroup":
        if (!t.attrs.id) break;
        group = [];
        root.colours.set(t.attrs.id, group);
        if (t.selfClosing) group = null;
        break;
      case "base":
        if (group) (group as (string | null)[]).push(colour(t.attrs.displaycolor));
        break;
      case "color":
        if (group) (group as (string | null)[]).push(colour(t.attrs.color));
        break;
      case "build":
        inBuild = !t.selfClosing;
        break;
      case "item":
        if (inBuild && t.attrs.objectid) root.items.push(t.attrs.objectid);
        break;
    }
  };
  const stream = new TagStream(onTag);
  if (!scanEntry(bytes, ROOT, ROOT_MAX, (d) => stream.pushBytes(d), all)) throw new FactsError(`threemf: no ${ROOT}`);
  stream.end();
  return root;
}

type SettingsPart = { id: string; normal: boolean; extruder: number };
type SettingsObject = { name: string | null; extruder: number; parts: SettingsPart[] };

/** Bambu's model_settings.config: per root object its name, extruder and parts (a part's own metadata is inside its element). */
function readSettings(text: string): Map<string, SettingsObject> {
  const out = new Map<string, SettingsObject>();
  let object: SettingsObject | null = null;
  let part: SettingsPart | null = null;
  scanTags(text, (t) => {
    if (t.end) {
      if (t.name === "part") part = null;
      else if (t.name === "object") object = null;
      return;
    }
    if (t.name === "object" && t.attrs.id && !object) {
      object = { name: null, extruder: 0, parts: [] };
      out.set(t.attrs.id, object);
      if (t.selfClosing) object = null;
    } else if (object && t.name === "part" && t.attrs.id) {
      part = { id: t.attrs.id, normal: (t.attrs.subtype ?? "normal_part") === "normal_part", extruder: 0 };
      (object as SettingsObject).parts.push(part);
      if (t.selfClosing) part = null;
    } else if (object && t.name === "metadata" && t.attrs.key) {
      const extruder = t.attrs.key === "extruder" ? Number.parseInt(t.attrs.value ?? "", 10) || 0 : null;
      if (part && extruder !== null) (part as SettingsPart).extruder = extruder;
      else if (!part && extruder !== null) (object as SettingsObject).extruder = extruder;
      else if (!part && t.attrs.key === "name") (object as SettingsObject).name = t.attrs.value || null;
    }
  });
  return out;
}

/** Bambu's slots from project_settings.config; one slot of unknown filament when it says nothing readable. */
function readSlots(text: string | null): FactsSlot[] {
  let colours: unknown = null;
  let types: unknown = null;
  try {
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    colours = json?.filament_colour;
    types = json?.filament_type;
  } catch {
    // not JSON: as if it said nothing
  }
  const c = Array.isArray(colours) ? colours : [];
  const ty = Array.isArray(types) ? types : [];
  const n = Math.max(c.length, ty.length);
  if (n === 0) return [{ slot: 1, type: null, color: null }];
  return Array.from({ length: n }, (_, i) => ({
    slot: i + 1,
    type: typeof ty[i] === "string" && ty[i] ? (ty[i] as string) : null,
    color: typeof c[i] === "string" ? colour(c[i] as string) : null,
  }));
}

function bambuParts(root: Root, settings: Map<string, SettingsObject>, slots: FactsSlot[]): FactsPart[] {
  const slotOf = (extruder: number) => (extruder >= 1 && extruder <= slots.length ? extruder : null);
  const parts: FactsPart[] = [];
  for (const id of new Set(root.items)) {
    const object = root.objects.get(id);
    if (!object) continue;
    const s = settings.get(id);
    const own = s?.extruder || 1;
    const name = s?.name ?? object.name;
    if (object.components.length === 0) {
      parts.push({ key: `${id}:0`, name, object: id, components: null, slot: slotOf(own) });
      continue;
    }
    const groups = new Map<number, number[]>();
    if (s && s.parts.length) {
      for (const p of s.parts) {
        if (!p.normal) continue;
        const indices = object.components.flatMap((c, j) => (c === p.id ? [j] : []));
        if (!indices.length) continue;
        const extruder = p.extruder || own;
        groups.set(extruder, [...(groups.get(extruder) ?? []), ...indices]);
      }
    } else
      groups.set(
        own,
        object.components.map((_, j) => j),
      );
    [...groups].forEach(([extruder, components], n) =>
      parts.push({ key: `${id}:${n}`, name, object: id, components: components.sort((a, b) => a - b), slot: slotOf(extruder) }),
    );
  }
  return parts;
}

function plainParts(root: Root): { parts: FactsPart[]; slots: FactsSlot[] } {
  const pick = (pid: string | null, index: string | null) => (pid ? (root.colours.get(pid)?.[Number.parseInt(index ?? "0", 10) || 0] ?? null) : null);
  const colours: string[] = [];
  const objects = [...new Set(root.items)].flatMap((id) => {
    const object = root.objects.get(id);
    if (!object) return [];
    const c = pick(object.pid, object.pindex) ?? (object.tri ? pick(object.tri.pid, object.tri.p || object.pindex) : null);
    if (c && !colours.includes(c)) colours.push(c);
    return [{ object, c }];
  });
  if (colours.length === 0) {
    return {
      slots: [{ slot: 1, type: null, color: null }],
      parts: objects.map(({ object }) => part(object, 1)),
    };
  }
  return {
    slots: colours.map((color, i) => ({ slot: i + 1, type: null, color })),
    parts: objects.map(({ object, c }) => part(object, c ? colours.indexOf(c) + 1 : null)),
  };
}

const part = (object: RootObject, slot: number | null): FactsPart => ({
  key: `${object.id}:0`,
  name: object.name,
  object: object.id,
  components: object.components.length ? object.components.map((_, j) => j) : null,
  slot,
});

const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

/** A number of grams or seconds as written, rounded to hundredths; 0 when it isn't one. */
const amount = (v: string | undefined) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/**
 * Bambu Studio's Metadata/slice_info.config: per sliced plate its time (`prediction`, seconds), weight and each filament's grams
 * (`used_g`), summed over the plates; null when no plate has a time or a weight (the file was not sliced).
 */
function readFigures(xml: string | null): FactsFigures | null {
  if (!xml) return null;
  let seconds = 0;
  let grams = 0;
  let sliced = false;
  let inPlate = false;
  const filaments = new Map<number, FactsFilament>();
  scanTags(xml, (t) => {
    if (t.name === "plate") inPlate = !t.end && !t.selfClosing;
    if (!inPlate || t.end) return;
    if (t.name === "metadata" && (t.attrs.key === "prediction" || t.attrs.key === "weight")) {
      const n = amount(t.attrs.value);
      if (n > 0) sliced = true;
      if (t.attrs.key === "prediction") seconds += n;
      else grams += n;
    } else if (t.name === "filament") {
      const slot = Number.parseInt(t.attrs.id ?? "", 10);
      const g = amount(t.attrs.used_g);
      if (!(slot >= 1) || g === 0) return;
      const had = filaments.get(slot);
      filaments.set(slot, {
        slot,
        type: had?.type ?? (t.attrs.type || null),
        color: had?.color ?? colour(t.attrs.color),
        grams: Math.round(((had?.grams ?? 0) + g) * 100) / 100,
      });
    }
  });
  if (!sliced) return null;
  return { seconds: Math.round(seconds), grams: Math.round(grams * 100) / 100, filaments: [...filaments.values()].sort((a, b) => a.slot - b.slot) };
}

/** The facts of a 3MF; throws FactsError when it has no root model or one too large to scan. */
export function readFacts(bytes: Uint8Array): Facts {
  const all = entries(bytes);
  const root = readRoot(bytes, all);
  const settings = text(readEntry(bytes, "Metadata/model_settings.config", CONFIG_MAX, all));
  const figures = readFigures(text(readEntry(bytes, "Metadata/slice_info.config", CONFIG_MAX, all)));
  if (settings === null) return { reader: READER, unit: root.unit, items: root.items, ...plainParts(root), figures };
  const slots = readSlots(text(readEntry(bytes, "Metadata/project_settings.config", CONFIG_MAX, all)));
  return { reader: READER, unit: root.unit, items: root.items, parts: bambuParts(root, readSettings(settings), slots), slots, figures };
}
