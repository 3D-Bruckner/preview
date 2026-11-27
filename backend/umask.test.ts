import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer, createModel } from "./index";
import { addVersion } from "./files";
import { testRuntime, type TestRuntime } from "./testing/runtime";

// docker-entrypoint.mjs sets umask 077 before anything is created: the database and the uploaded files are nobody else's to read.
let previous: number;
beforeEach(() => {
  previous = process.umask(0o077);
});
afterEach(() => {
  process.umask(previous);
});

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? [join(dir, e.name), ...walk(join(dir, e.name))] : [join(dir, e.name)]));

describe("under umask 077", () => {
  it("the databases and a version's files are not readable by group or others", async () => {
    const rt: TestRuntime = testRuntime();
    try {
      const c = createCustomer(rt, { name: "K" });
      const m = c.ok && createModel(rt, { customerId: c.value.id, title: "M" });
      if (!c.ok || !m || !m.ok) throw new Error("setup");
      const fx = (n: string) => ({ path: join(process.cwd(), "backend", "fixtures", n) });
      const tmp = mkdtempSync(join(rt.config.dataDir, "up-"));
      expect((await addVersion(rt, m.value.id, { threemf: fx("ramp.3mf"), preview: fx("preview.png"), drawings: [] })).ok).toBe(true);
      const paths = walk(rt.config.dataDir).filter((p) => !p.startsWith(tmp));
      expect(paths.some((p) => p.endsWith("preview.sqlite"))).toBe(true);
      expect(paths.some((p) => p.endsWith("model.3mf"))).toBe(true);
      for (const p of paths) expect(statSync(p).mode & 0o077, p).toBe(0);
    } finally {
      rt.store.close();
    }
  });
});
