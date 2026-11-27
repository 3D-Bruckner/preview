// Whether a path lies inside a directory: the one check for PREVIEW_LOGO when the settings are read (config.ts) and for the logo's real
// file when it is served (brand.ts).
import { isAbsolute, relative, resolve, sep } from "node:path";

/** True when `path` is below `root` (not `root` itself). A name that only starts with two dots, such as `..logo.svg`, is inside. */
export function isInside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
