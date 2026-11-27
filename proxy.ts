import { NextResponse, type NextRequest } from "next/server";
import { LANG_HEADER, languageOf } from "@/components/copy";

// The UI's language (conventions: code/language, Next's internationalization guide): every page lives under app/[lang], and the proxy
// rewrites a page's path to /<lang>/<path>, so no URL carries the language and every link and bookmark stays as it is. The language is
// the one picked in the switch (its cookie), else the browser's Accept-Language, else German; it is passed on as a request header too,
// for server components and server actions without a `lang` param.
//
// The proxy runs on pages only (the matcher). Route handlers stay outside app/[lang] and outside the proxy: the API, Better Auth's
// endpoints, MCP, the uploads, the health check and the OAuth metadata. Next 16 buffers the body of every request the proxy sees and passes
// on only its first 10 MB (proxyClientMaxBodySize, next/dist/server/body-streams.js), so an upload posted through it would arrive cut off; a
// route handler that needs the language picks it itself with languageOf. So are the files the Home Screen asks for: the manifest, the
// icons, anything with a file extension.

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const lang = languageOf(req.headers);
  const headers = new Headers(req.headers);
  headers.set(LANG_HEADER, lang);
  return NextResponse.rewrite(new URL(`/${lang}${pathname === "/" ? "" : pathname}${search}`, req.url), { request: { headers } });
}

export const config = {
  matcher: "/((?!api/|_next/|\\.well-known/|icons/|mcp$|health$|[^/]+\\.[a-zA-Z0-9]+$).*)",
};
