import { openAsBlob } from "node:fs";
import { versionFile } from "@/backend";
import { runtime } from "@/app/_lib/runtime";

// A version's preview picture for the web app (the model page's version cards): only for someone signed in, or an API token. Under
// /api, outside the proxy. The customer's own copy is app/k/[token]/files, by their link.
export async function GET(req: Request, ctx: RouteContext<"/api/versions/[id]/preview">) {
  const rt = runtime();
  if (!(await rt.person(req.headers)) && !(await rt.apiCaller(req))) return new Response(null, { status: 401 });
  const found = versionFile(rt, (await ctx.params).id, "preview");
  if (!found.ok) return new Response(null, { status: 404 });
  const body = await openAsBlob(found.value.path, { type: found.value.type });
  return new Response(body, {
    headers: {
      "content-type": found.value.type,
      "content-length": String(body.size),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
