import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pino and better-sqlite3 stay plain Node requires, so the standalone build traces them into node_modules. next-app-kit too: the
  // runtime (and its Auth) is opened once per process and kept on globalThis, and the kit knows an Auth it opened by a module-level
  // WeakMap, so every route and instrumentation.ts must share one copy of the kit, not one bundled into each.
  serverExternalPackages: ["pino", "better-sqlite3", "next-app-kit"],
  // The kit's command for the server's operator (`node node_modules/next-app-kit/dist/cli.js token …`, docs/configuration.md) is imported
  // by no route, so the standalone build wouldn't trace it.
  outputFileTracingIncludes: { "/**": ["./node_modules/next-app-kit/dist/**"] },
  // Tests, fixtures and test helpers under backend/ are imported by no route (the e2e seed and unit tests reach them), so they stay out of the image.
  outputFileTracingExcludes: { "*": ["backend/**/*.test.ts", "backend/fixtures/**", "backend/testing/**"] },
  // The root layout is in app/[lang] (conventions: code/language), so an address no route matches gets app/global-not-found.tsx.
  // Turbopack's cache on disk is off for the e2e server (PREVIEW_E2E, playwright.config.ts): a run of the admin or viewer tests left it in
  // a state where the next run's pages reloaded about 15 times a second, failing whichever tests came first. Each e2e run compiles afresh.
  experimental: { globalNotFound: true, turbopackFileSystemCacheForDev: process.env.PREVIEW_E2E !== "1" },
  // No page is ever framed: a page of another site must not overlay a "Save", "Delete" or "Allow" click. A customer's files and the logo
  // carry a policy of their own (sandboxed, loading nothing), which this one would replace.
  headers: async () => [{ source: "/((?!k/[^/]+/files/|brand/logo$).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] }],
};

export default nextConfig;
