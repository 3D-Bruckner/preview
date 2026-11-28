// A version's facts (backend/threemf) as stored: read at upload (files.ts), read again over MCP/REST after a reader fix (reread_facts),
// and at start for every version stored without them or by an older reader (fillMissingFacts: the versions uploaded before facts existed).
import { readFileSync } from "node:fs";
import { versionFile } from "./files";
import { invalid, notFound, ok, type Outcome } from "./outcome";
import { mutation, type Runtime } from "./runtime";
import { FactsError, READER, readFacts, type Facts } from "./threemf";

/** The facts a version row holds; null when not read yet (or unreadable, which only a hand-edited row can be). */
export function factsOf(row: { facts: string | null }): Facts | null {
  if (!row.facts) return null;
  try {
    return JSON.parse(row.facts) as Facts;
  } catch {
    return null;
  }
}

/** Reads a stored version's 3MF again and replaces its facts; a file that can't be read leaves them as they were. */
export function rereadFacts(rt: Runtime, versionId: string): Outcome<{ parts: number }> {
  const file = versionFile(rt, versionId, "3mf");
  if (!file.ok) return file;
  let facts: Facts;
  try {
    facts = readFacts(readFileSync(file.value.path));
  } catch (e) {
    if (e instanceof FactsError) return invalid(e.message);
    throw e;
  }
  return mutation(rt, () => {
    if (!rt.store.version(versionId)) return notFound(`No version ${versionId}.`);
    rt.store.setFacts(versionId, JSON.stringify(facts));
    return ok({ parts: facts.parts.length });
  });
}

/** Reads the facts of every version that has none, or has them from an older reader; how many were read and how many failed. */
export function fillMissingFacts(rt: Runtime): { read: number; failed: number } {
  let read = 0;
  let failed = 0;
  for (const row of rt.store.versionFacts()) {
    const facts = factsOf(row);
    if (facts && facts.reader >= READER) continue;
    if (rereadFacts(rt, row.id).ok) read++;
    else failed++;
  }
  return { read, failed };
}
