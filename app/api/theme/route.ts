import { switchedBack } from "@/app/_lib/back";
import { isTheme, THEME_COOKIE } from "@/components/theme";

// The theme switch (components/ThemeSwitch.tsx) posts here, as the language switch posts to /api/language: the picked theme goes into a
// cookie and the browser goes back. A plain form, so it works without JavaScript; a POST, so nothing changes on a GET.
export async function POST(req: Request) {
  const theme = (await req.formData()).get("theme");
  if (!isTheme(theme)) return Response.json({ error: "unknown theme" }, { status: 400 });
  return switchedBack(req, THEME_COOKIE, theme);
}
