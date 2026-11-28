// Reading a 3MF on the server: its parts, filament slots and print figures, never its meshes (the browser draws those).
export { readFacts } from "./facts";
export { readThumbnail } from "./thumbnail";
export { FactsError, readEntry } from "./zip";
export { emptyFacts, READER, UNIT_MM, type Facts, type FactsFigures, type FactsFilament, type FactsPart, type FactsSlot } from "./types";
