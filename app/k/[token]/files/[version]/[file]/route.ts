import { openAsBlob } from "node:fs";
import { notFound } from "next/navigation";
import { customerFile } from "@/backend";
import { runtime } from "@/app/_lib/runtime";

// A file of a customer's version (the 3MF the 3D view loads, the preview, a drawing), by the customer's link token: customerFile lets
// through only the token's customer's own files, and anything else answers the same 404 as a missing page. Outside app/[lang] and the
// proxy, so no language is picked and no cookie set. Shown in the page, never offered as a download (inline); a stored SVG drawing may
// carry script, so every file is sandboxed and may load nothing (the CSP), and it is never indexed.
const HEADERS = {
  "content-disposition": "inline",
  "cache-control": "private, max-age=3600",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
};

export async function GET(_req: Request, ctx: RouteContext<"/k/[token]/files/[version]/[file]">) {
  const { token, version, file } = await ctx.params;
  const found = customerFile(runtime(), token, version, file);
  if (!found) notFound();
  const body = await openAsBlob(found.path, { type: found.type });
  return new Response(body, { headers: { ...HEADERS, "content-type": found.type, "content-length": String(body.size) } });
}
