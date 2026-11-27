import { NextResponse, type NextRequest } from "next/server";
import { customerLanguage } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { cookieValue, isLocale, LANG_COOKIE, LANG_HEADER, languageOf, type Locale } from "@/components/copy";

// The UI's language (conventions: code/language, Next's internationalization guide): every page lives under app/[lang], and the proxy
// rewrites a page's path to /<lang>/<path>, so no URL carries the language and every link and bookmark stays as it is. The language is
// the one picked in the switch (its cookie), else the browser's Accept-Language, else German; it is passed on as a request header too,
// for server components and server actions without a `lang` param.
//
// The proxy runs on pages only (the matcher). Route handlers stay outside app/[lang] and outside the proxy: the API, Better Auth's
// endpoints, MCP, the uploads, the health check and the OAuth metadata. Next 16 buffers the body of every request the proxy sees and passes
// on only its first 10 MB (proxyClientMaxBodySize, next/dist/server/body-streams.js), so an upload posted through it would arrive cut off; a
// route handler that needs the language picks it itself with languageOf. So are the files the Home Screen asks for: the manifest, the
// icons, anything with a file extension, a customer's files (app/k/[token]/files) and the brand's logo.
//
// A customer's pages (/k/<token>…) open in the customer's language (customerLanguage) unless the visitor picked one in the switch; a
// token that opens nothing falls back to the browser's, like any page. The proxy sets no cookie (only the switch does), and keeps the
// customer pages out of search engines and the token out of other sites' Referer.
const CUSTOMER_PAGE = /^\/k\/([^/]+)/;

function languageFor(req: NextRequest, token: string | undefined): Locale {
  if (token && !isLocale(cookieValue(req.headers.get("cookie"), LANG_COOKIE))) {
    const lang = customerLanguage(runtime(), token);
    if (lang) return lang;
  }
  return languageOf(req.headers);
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = CUSTOMER_PAGE.exec(pathname)?.[1];
  const lang = languageFor(req, token);
  const headers = new Headers(req.headers);
  headers.set(LANG_HEADER, lang);
  const res = NextResponse.rewrite(new URL(`/${lang}${pathname === "/" ? "" : pathname}${search}`, req.url), { request: { headers } });
  if (token) {
    res.headers.set("x-robots-tag", "noindex, nofollow");
    res.headers.set("referrer-policy", "same-origin");
  }
  return res;
}

export const config = {
  matcher: "/((?!api/|_next/|\\.well-known/|icons/|brand/logo$|k/[^/]+/files/|mcp$|health$|[^/]+\\.[a-zA-Z0-9]+$).*)",
};
