import { openAsBlob } from "node:fs";
import { logoFile } from "@/backend";
import { runtime } from "@/app/_lib/runtime";

// The brand's logo (PREVIEW_LOGO), for the customer pages' header: pages get this address, never the file's path. logoFile checks the
// real file (symbolic links followed) is an .svg or .png inside DATA_DIR. An SVG may carry script, so it is sandboxed, may load nothing and is never framed.
export async function GET() {
  const logo = logoFile(runtime().config);
  if (!logo) return new Response(null, { status: 404 });
  const body = await openAsBlob(logo.path, { type: logo.type });
  return new Response(body, {
    headers: {
      "content-type": logo.type,
      "content-length": String(body.size),
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox",
    },
  });
}
