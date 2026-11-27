// Removes the run's temporary data directory (playwright.config.ts made it).
import { rmSync } from "node:fs";

export default function teardown(): void {
  if (process.env.E2E_DATA_DIR) rmSync(process.env.E2E_DATA_DIR, { recursive: true, force: true });
}
