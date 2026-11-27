// Reading single entries of a zip with a bound on what they inflate to. The entries are found in the central directory (whose sizes a
// streaming reader of local headers can't rely on: writers may put them after the data), and each is inflated in small pieces through
// fflate's streaming Inflate, counting: past the bound it stops, so a few KB that inflate to gigabytes cost nothing but the time to count.
import { Inflate } from "fflate";

export class FactsError extends Error {}

type Entry = { name: string; method: number; size: number; offset: number };

const u16 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
const utf8 = new TextDecoder();

/** The zip's entries by name, from its central directory. */
export function entries(bytes: Uint8Array): Map<string, Entry> {
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (u32(bytes, at) === 0x06054b50) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new FactsError("threemf: not a zip");
  const count = u16(bytes, eocd + 10);
  let at = u32(bytes, eocd + 16);
  const out = new Map<string, Entry>();
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || u32(bytes, at) !== 0x02014b50) throw new FactsError("threemf: a broken zip directory");
    const nameLen = u16(bytes, at + 28);
    const name = utf8.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    out.set(name, { name, method: u16(bytes, at + 10), size: u32(bytes, at + 20), offset: u32(bytes, at + 42) });
    at += 46 + nameLen + u16(bytes, at + 30) + u16(bytes, at + 32);
  }
  return out;
}

const PIECE = 16 * 1024;

/** Inflates one entry piece by piece into `onData`; throws past `maxBytes` inflated. */
function inflate(bytes: Uint8Array, e: Entry, maxBytes: number, onData: (d: Uint8Array) => void): void {
  const at = e.offset;
  if (at + 30 > bytes.length || u32(bytes, at) !== 0x04034b50) throw new FactsError("threemf: a broken zip entry");
  const start = at + 30 + u16(bytes, at + 26) + u16(bytes, at + 28);
  const data = bytes.subarray(start, Math.min(bytes.length, start + e.size));
  let total = 0;
  const take = (d: Uint8Array) => {
    total += d.length;
    if (total > maxBytes) throw new FactsError("threemf: too large inside");
    if (d.length) onData(d);
  };
  if (e.method === 0) {
    for (let i = 0; i < data.length; i += PIECE) take(data.subarray(i, i + PIECE));
    return;
  }
  if (e.method !== 8) throw new FactsError("threemf: an entry packed in a way zip readers rarely know");
  const inf = new Inflate((d) => take(d));
  try {
    for (let i = 0; i < data.length; i += PIECE) inf.push(data.subarray(i, i + PIECE), i + PIECE >= data.length);
    if (data.length === 0) inf.push(new Uint8Array(0), true);
  } catch (err) {
    if (err instanceof FactsError) throw err;
    throw new FactsError("threemf: an entry that doesn't inflate");
  }
}

/** One entry's bytes, or null when the zip has none of that name. */
export function readEntry(bytes: Uint8Array, name: string, maxBytes: number, all = entries(bytes)): Uint8Array | null {
  const e = all.get(name);
  if (!e) return null;
  const parts: Uint8Array[] = [];
  inflate(bytes, e, maxBytes, (d) => parts.push(d.slice()));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** One entry's bytes in pieces, never whole (each piece is valid only during the call); false when the zip has none of that name. */
export function scanEntry(bytes: Uint8Array, name: string, maxBytes: number, onBytes: (d: Uint8Array) => void, all = entries(bytes)): boolean {
  const e = all.get(name);
  if (!e) return false;
  inflate(bytes, e, maxBytes, onBytes);
  return true;
}
