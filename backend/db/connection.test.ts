import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "./connection";
import { MIGRATIONS } from "./migrations";

describe("openDatabase", () => {
  it("opens preview.sqlite in WAL mode with foreign keys on, at the last migration", () => {
    const { raw } = openDatabase(mkdtempSync(join(process.env.DATA_DIR!, "db-")));
    try {
      expect(raw.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(raw.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(raw.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);
      const tables = raw.prepare("select name from sqlite_master where type = 'table' order by name").pluck().all();
      expect(tables).toEqual(["customers", "drawings", "feedback", "filaments", "models", "slice_jobs", "version_views", "versions"]);
    } finally {
      raw.close();
    }
  });

  it("opens an existing file again without running a migration twice", () => {
    const dir = mkdtempSync(join(process.env.DATA_DIR!, "db-"));
    openDatabase(dir).raw.close();
    const { raw } = openDatabase(dir);
    expect(raw.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);
    raw.close();
  });
});
