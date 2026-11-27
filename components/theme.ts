// The light/dark choice (components/ThemeSwitch.tsx, app/api/theme): auto follows the system, light and dark override it. The root layout
// reads the cookie and sets data-theme on <html> for light and dark; app/globals.css keys the dark palette on it. Pure: no Next.js here.
export const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "preview_theme";

export const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);

/** The cookie's theme; anything else, a tampered value included, is auto. */
export const themeOf = (cookieValue: string | undefined): Theme => (isTheme(cookieValue) ? cookieValue : "auto");
