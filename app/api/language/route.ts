import { switchedBack } from "@/app/_lib/back";
import { isLocale, LANG_COOKIE } from "@/components/copy";

// The language switch (components/LanguageSwitch.tsx) posts here: the picked language goes into a cookie that wins over the browser's
// languages, and the browser goes back to the page it came from. A plain form, so it works without JavaScript; a POST, so nothing changes
// on a GET.
export async function POST(req: Request) {
  const lang = (await req.formData()).get("lang");
  if (!isLocale(lang)) return Response.json({ error: "unknown language" }, { status: 400 });
  return switchedBack(req, LANG_COOKIE, lang);
}
