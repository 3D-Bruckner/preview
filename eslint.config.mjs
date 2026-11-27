import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// The frontend/backend boundary: app/, components/, proxy.ts and instrumentation.ts import the backend only through @/backend
// (backend/index.ts), or @/backend/client (pure code for the browser), and backend/ is framework-free.
const FRONTEND = {
  patterns: [
    {
      group: ["@/backend/*", "**/backend/*", "!@/backend/client"],
      message: "The frontend imports the backend only through @/backend (backend/index.ts), or @/backend/client in the browser.",
    },
  ],
};
const BACKEND = {
  paths: ["next", "react", "react-dom"].map((name) => ({ name, message: "backend/ is framework-free." })),
  patterns: [
    { group: ["next/*", "react/*", "react-dom/*"], message: "backend/ is framework-free." },
    { group: ["@/app/*", "@/components/*", "@/proxy", "@/instrumentation", "**/app/*", "**/components/*"], message: "backend/ never imports the frontend." },
    { group: ["@/backend", "@/backend/*"], message: "Inside backend/, use relative imports." },
  ],
};
// The data layer (conventions: architecture/data-layer): only backend/db/ holds the database client, the connection and the migrations.
// Everything else calls its functions through backend/db/index.ts; kysely's and better-sqlite3's types are allowed.
const DATA_LAYER = {
  paths: ["kysely", "better-sqlite3"].map((name) => ({ name, allowTypeImports: true, message: "Only backend/db/ talks to the database." })),
  patterns: [{ group: ["**/db/*"], message: "Outside backend/db/, take the data layer from backend/db (its index.ts)." }],
};
const merge = (...rules) => ({ paths: rules.flatMap((r) => r.paths ?? []), patterns: rules.flatMap((r) => r.patterns ?? []) });

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // One no-restricted-imports per file: a later config object replaces an earlier one's options instead of adding to them.
  {
    files: ["app/**", "components/**", "proxy.ts", "instrumentation.ts"],
    ignores: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-restricted-imports": ["error", merge(FRONTEND, DATA_LAYER)] },
  },
  { files: ["backend/**"], ignores: ["backend/db/**"], rules: { "@typescript-eslint/no-restricted-imports": ["error", merge(BACKEND, DATA_LAYER)] } },
  { files: ["backend/db/**"], rules: { "@typescript-eslint/no-restricted-imports": ["error", BACKEND] } },
  // Text in the UI comes from the copy modules (components/copy/), never from JSX (conventions: code/language).
  { files: ["app/**/*.tsx", "components/**/*.tsx"], rules: { "react/jsx-no-literals": ["error", { noStrings: false, allowedStrings: ["·"] }] } },
  // Last, so no ESLint rule argues with Prettier's layout.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);
