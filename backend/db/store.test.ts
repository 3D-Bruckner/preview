import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openStore } from "./store";

describe("Store.transaction", () => {
  // Two processes share the file in the end-to-end tests (the server and a test's seed). A transaction that reads, then writes after the
  // other committed, must not fail at once with "database is locked": it takes the write lock first, and the other waits for it.
  it("holds the write lock from its start, so a read then a write never meets another connection's commit in between", () => {
    const dir = mkdtempSync(join(process.env.DATA_DIR!, "db-"));
    const a = openStore(dir);
    const b = openStore(dir);
    try {
      const row = (id: string) => ({ id, name: id, note: null, language: "de" as const, link_token: null, created_at: "2026-11-28T00:00:00Z" });
      a.transaction(() => {
        a.customersByName();
        expect(() => b.insertCustomer(row("andere"))).toThrow(/locked|busy/i);
        a.insertCustomer(row("erste"));
      });
      expect(a.customersByName().map((c) => c.id)).toEqual(["erste"]);
    } finally {
      a.close();
      b.close();
    }
  }, 15_000);
});
