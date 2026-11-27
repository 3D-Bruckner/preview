// The UI's languages (conventions: code/language): one copy module per language, English the reference, the others typed as Copy; adding
// a language is adding its module here. The language is the one picked in the switch (its cookie), else the browser's Accept-Language,
// else German (the default: preview's first users speak it); proxy.ts picks it and rewrites each page to app/[lang]/, so no URL carries it. Server code takes copyFor(lang); client components useCopy() (components/CopyProvider.tsx).
import { de } from "./de";
import { en, type Copy } from "./en";

export type { Copy } from "./en";

export const COPIES = { en, de } satisfies Record<string, Copy>;
export type Locale = keyof typeof COPIES;
export const LOCALES = Object.keys(COPIES) as Locale[];
export const DEFAULT_LOCALE: Locale = "de";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && Object.hasOwn(COPIES, v);
export const copyFor = (lang: string): Copy => COPIES[isLocale(lang) ? lang : DEFAULT_LOCALE];

/** The cookie the language switch sets, which wins over the browser's languages. */
export const LANG_COOKIE = "preview_lang";
/** The request header proxy.ts sets to the page's language, for server components without a `lang` param. */
export const LANG_HEADER = "x-preview-lang";

/** The value of the cookie `name` in a Cookie header, if it is there. */
export function cookieValue(cookieHeader: string | null, name: string): string | undefined {
  for (const part of (cookieHeader ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

/**
 * The language of a request by its headers: the switch's cookie, else Accept-Language, else German. proxy.ts picks each page's language
 * with it, and the sign-in mail is written in it (next-app-kit's languageOf, app/_lib/runtime.ts), so the mail speaks the page's language.
 */
export const languageOf = (headers: Headers): Locale => negotiate(cookieValue(headers.get("cookie"), LANG_COOKIE), headers.get("accept-language"));

/** The language for a request: the picked one if the UI speaks it, else the best of Accept-Language by weight ("de-AT" matches "de"), else German. */
export function negotiate(picked: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(picked)) return picked;
  const asked = (acceptLanguage ?? "")
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((a) => a.tag && a.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of asked) {
    if (isLocale(tag)) return tag;
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
