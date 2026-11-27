import { safeNext } from "next-app-kit/signin";
import { isLocale, LANG_COOKIE } from "@/components/copy";

// The language switch (components/LanguageSwitch.tsx) posts here: the picked language goes into a cookie that wins over the browser's
// languages, and the browser goes back to the page it came from (its Referer, a path of this app only). A plain form, so it works
// without JavaScript; a POST, so nothing changes on a GET.
const YEAR = 365 * 24 * 60 * 60;

export async function POST(req: Request) {
  const lang = (await req.formData()).get("lang");
  if (!isLocale(lang)) return Response.json({ error: "unknown language" }, { status: 400 });
  const referer = req.headers.get("referer");
  let back = "/";
  try {
    if (referer) {
      const url = new URL(referer);
      back = safeNext(url.pathname + url.search);
    }
  } catch {
    // not a URL: back to the start page
  }
  return new Response(null, {
    status: 303,
    headers: { location: back, "set-cookie": `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${YEAR}; SameSite=Lax; HttpOnly`, "cache-control": "no-store" },
  });
}
