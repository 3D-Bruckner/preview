// End-to-end tests against `next dev` (conventions: Next.js app). The server's data lives in a new temporary directory each run, removed
// by e2e/teardown.ts.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const PORT = 3310;
// Made once, in the main process, with the brand's logo in it; the workers that load this file again inherit it.
if (!process.env.E2E_DATA_DIR) {
  process.env.E2E_DATA_DIR = mkdtempSync(join(tmpdir(), "preview-e2e-"));
  mkdirSync(join(process.env.E2E_DATA_DIR, "brand"));
  writeFileSync(
    join(process.env.E2E_DATA_DIR, "brand", "logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32"/></svg>',
  );
}

export default defineConfig({
  testDir: "e2e",
  globalTeardown: "./e2e/teardown.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // The dev server compiles each route on its first request, which on CI's runners can take longer than the default 5 seconds.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  // A test that opens several pages waits for each to compile on its first request.
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_DIR: process.env.E2E_DATA_DIR,
      PUBLIC_URL: `http://localhost:${PORT}`,
      PORT: String(PORT),
      PREVIEW_E2E: "1",
      PREVIEW_SECRET: "e2e-secret-".padEnd(48, "x"),
      PREVIEW_ALLOWED_EMAILS: "owner@example.com",
      // Sign-in by email is on, so the instance has a way in; the tests never send a mail.
      PREVIEW_SMTP_URL: "smtp://127.0.0.1:2525",
      PREVIEW_SMTP_FROM: "preview <noreply@example.com>",
      // An instance's brand, so the tests see that the pages show the settings' brand and name nobody else.
      PREVIEW_BRAND_NAME: "Test Studio",
      PREVIEW_LOGO: "brand/logo.svg",
      PREVIEW_IMPRINT_URL: "https://studio.example.com/imprint",
    },
  },
});
