import { copyFor, LOCALES, type Locale } from "@/components/copy";

// The header's language switch: one button per language, each language's name in its own language (and marked so). It posts to
// /api/language, which keeps the choice in a cookie and sends the browser back.
export function LanguageSwitch({ lang }: { lang: Locale }) {
  const t = copyFor(lang).language;
  return (
    <form method="post" action="/api/language" aria-label={t.label} className="flex gap-2 text-sm">
      {LOCALES.map((l) => (
        <button key={l} type="submit" name="lang" value={l} lang={l} aria-pressed={l === lang} className={l === lang ? "font-semibold" : "underline"}>
          {t.names[l]}
        </button>
      ))}
    </form>
  );
}
