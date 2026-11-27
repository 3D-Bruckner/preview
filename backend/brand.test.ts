import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { logoFile } from "./brand";
import { loadConfig } from "./config";

const config = (dataDir: string, logo: string) =>
  loadConfig({ PUBLIC_URL: "https://preview.example.com", PREVIEW_SECRET: "s".repeat(32), DATA_DIR: dataDir, PREVIEW_LOGO: logo });

describe("logoFile", () => {
  it("serves an .svg or .png inside DATA_DIR, and nothing a symbolic link leads out of it to", () => {
    const dataDir = mkdtempSync(join(process.env.DATA_DIR!, "brand-"));
    // Next to it, so outside it (and removed with the test's DATA_DIR).
    const outside = mkdtempSync(join(process.env.DATA_DIR!, "outside-"));
    mkdirSync(join(dataDir, "brand"));
    writeFileSync(join(dataDir, "brand", "logo.svg"), "<svg/>");
    writeFileSync(join(outside, "secret.svg"), "<svg/>");
    symlinkSync(join(outside, "secret.svg"), join(dataDir, "brand", "away.svg"));
    symlinkSync(join(dataDir, "preview.sqlite"), join(dataDir, "brand", "db.png"));
    writeFileSync(join(dataDir, "preview.sqlite"), "db");

    expect(logoFile(config(dataDir, "brand/logo.svg"))).toEqual({ path: join(dataDir, "brand", "logo.svg"), type: "image/svg+xml" });
    expect(logoFile(config(dataDir, "brand/away.svg"))).toBeNull();
    // Inside, but not an .svg or .png once the link is followed.
    expect(logoFile(config(dataDir, "brand/db.png"))).toBeNull();
    expect(logoFile(config(dataDir, "brand/missing.png"))).toBeNull();
    expect(logoFile(loadConfig({ PUBLIC_URL: "https://preview.example.com", PREVIEW_SECRET: "s".repeat(32), DATA_DIR: dataDir }))).toBeNull();
  });
});
