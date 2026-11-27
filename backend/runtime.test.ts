import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signInSettings } from "./accounts";
import { loadConfig } from "./config";
import { log } from "./log";
import { openRuntime } from "./runtime";
import { TEST_MAIL } from "./testing/runtime";

describe("openRuntime", () => {
  it("opens DATA_DIR/preview.sqlite, creating the directory, and runs the migrations; sign-in opens auth.sqlite beside it at first use", async () => {
    const dataDir = join(process.env.DATA_DIR!, "nested", "data");
    const env = {
      NODE_ENV: "test",
      PUBLIC_URL: "https://preview.example.com",
      PREVIEW_SECRET: "s".repeat(32),
      DATA_DIR: dataDir,
      PREVIEW_SMTP_URL: "smtp://x",
    };
    const rt = openRuntime(loadConfig(env), signInSettings(env, dataDir, log), TEST_MAIL);
    try {
      expect(existsSync(join(dataDir, "preview.sqlite"))).toBe(true);
      expect(existsSync(join(dataDir, "auth.sqlite"))).toBe(false);
      expect(rt.store.answers()).toBe(true);
      expect(rt.clock()).toBeInstanceOf(Date);
      expect(rt.fetch).toBe(globalThis.fetch);
      // A cookie or a token Better Auth didn't make is nobody.
      expect(await rt.person(new Headers({ cookie: "better-auth.session_token=x.y" }))).toBeNull();
      expect(await rt.apiCaller(new Request("http://localhost/", { headers: { authorization: "Bearer preview_x" } }))).toBeNull();
      expect(existsSync(join(dataDir, "auth.sqlite"))).toBe(true);
      expect(await rt.auth()).toBe(await rt.auth());
    } finally {
      rt.store.close();
    }
  });
});
