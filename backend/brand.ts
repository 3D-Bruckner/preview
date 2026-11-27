// The brand's logo as app/brand/logo/route.ts serves it. PREVIEW_LOGO was checked to lie inside DATA_DIR when the settings were read
// (config.ts), but only as a path: a symbolic link there could still point anywhere, so the file actually opened is checked again here.
import { realpathSync, statSync } from "node:fs";
import { extname } from "node:path";
import type { Config } from "./config";
import { isInside } from "./paths";

const TYPES: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png" };

/** The logo's real path and type, or null when none is set, it is missing, or it resolves to anything but an .svg or .png inside DATA_DIR. */
export function logoFile(config: Config): { path: string; type: string } | null {
  if (!config.brand.logo) return null;
  try {
    const root = realpathSync(config.dataDir);
    const path = realpathSync(config.brand.logo);
    if (!isInside(root, path)) return null;
    const type = TYPES[extname(path).toLowerCase()];
    if (!type || !statSync(path).isFile()) return null;
    return { path, type };
  } catch {
    return null;
  }
}
