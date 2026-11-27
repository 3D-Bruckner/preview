// What preview knows about a version's 3MF, read once at upload (backend/threemf/facts.ts). Pure types and constants: the browser gets
// them through @/backend/client.

/** The reader's version: facts read by an older one are read again at start (fillMissingFacts). */
export const READER = 1;

/** Millimetres per unit of a 3MF's `<model unit>`. */
export const UNIT_MM: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

/** A filament slot (Bambu's extruder), 1-based; `color` is `#rrggbb` in lower case. */
export type FactsSlot = { slot: number; type: string | null; color: string | null };

/** A part: an object of the build, or within an object of a Bambu project the components printed in one filament. `key` is
 * `<objectId>:<n>` (n: the filament group within the object, in order of first appearance); `components` are 0-based indices of the root
 * object's `<component>`s, null for an object that is a mesh itself; `slot` is null when the file doesn't say or names a slot it hasn't. */
export type FactsPart = { key: string; name: string | null; object: string; components: number[] | null; slot: number | null };

/** `items`: the `objectid` of each `<build>` item, in order (an object placed twice is two items and one part); `unit`: mm per unit. */
export type Facts = { reader: typeof READER; unit: number; items: string[]; parts: FactsPart[]; slots: FactsSlot[] };

/** The facts of a version whose 3MF hasn't been read yet: no parts, shown as a whole. */
export const emptyFacts = (): Facts => ({ reader: READER, unit: 1, items: [], parts: [], slots: [] });
