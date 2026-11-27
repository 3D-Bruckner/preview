import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Every test runs with DATA_DIR in a temporary directory of its own (conventions: code/tests-temp-dirs).
    setupFiles: ["./backend/testing/setup.ts"],
    include: ["backend/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.ts", "components/**/*.test.tsx", "proxy.test.ts"],
    exclude: ["**/node_modules/**", ".next/**", "e2e/**"],
  },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
