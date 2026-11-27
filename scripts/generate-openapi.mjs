// npm run generate: writes openapi.json, the REST table's OpenAPI document (the kit's openApiDocument over backend/rest.ts's REST_OPS),
// formatted as Prettier formats it. With --check (CI) it writes nothing and fails when the committed file differs; backend/rest.test.ts
// checks the same. The TypeScript is loaded through Vite's module runner (Vitest's), with the project's Vitest config for the @ alias.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = fileURLToPath(new URL("../openapi.json", import.meta.url));

const { module } = await runnerImport("/backend/rest.ts", {
  root,
  configFile: fileURLToPath(new URL("../vitest.config.mts", import.meta.url)),
  logLevel: "error",
});
const text = await format(JSON.stringify(module.openApiFile()), { ...(await resolveConfig(out)), filepath: out });
if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
    console.error("openapi.json differs from the REST table: run npm run generate and commit it");
    process.exit(1);
  }
  console.log("openapi.json is current");
} else {
  writeFileSync(out, text);
  console.log(`wrote ${out}`);
}
