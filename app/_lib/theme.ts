import { cookies } from "next/headers";
import { THEME_COOKIE, themeOf, type Theme } from "@/components/theme";

/** The request's theme from the theme switch's cookie (components/ThemeSwitch.tsx); auto when there is none. */
export async function currentTheme(): Promise<Theme> {
  return themeOf((await cookies()).get(THEME_COOKIE)?.value);
}
