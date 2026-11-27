// Reading a 3MF on the server: its parts and filament slots, never its meshes (the browser draws those).
export { readFacts } from "./facts";
export { FactsError, readEntry } from "./zip";
export { emptyFacts, READER, UNIT_MM, type Facts, type FactsPart, type FactsSlot } from "./types";
