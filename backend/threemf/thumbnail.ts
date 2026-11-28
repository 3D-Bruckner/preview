// The picture a slicer put in a 3MF, used as a version's preview when the upload brings none: Bambu Studio writes one per plate
// (Metadata/plate_1.png), other writers the package thumbnail (Metadata/thumbnail.png). Read with the same bound as the configs, and
// only a real PNG counts.
import { entries, readEntry } from "./zip";

const CANDIDATES = ["Metadata/plate_1.png", "Metadata/thumbnail.png"];
const MAX = 16 * 1024 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The 3MF's own preview picture (a PNG), or null when it has none. Throws FactsError for a broken zip. */
export function readThumbnail(bytes: Uint8Array): Uint8Array | null {
  const all = entries(bytes);
  for (const name of CANDIDATES) {
    const png = readEntry(bytes, name, MAX, all);
    if (png && png.length > PNG.length && PNG.every((b, i) => png[i] === b)) return png;
  }
  return null;
}
