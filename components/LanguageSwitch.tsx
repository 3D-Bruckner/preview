import { copyFor, LOCALES, type Locale } from "@/components/copy";
import { Flag } from "@/components/flags";

// The header's language switch: a flag per language, each button named by its language in its own language (and marked so), the current
// one pressed and framed (not by colour alone). It posts to /api/language, which keeps the choice in a cookie and sends the browser back.
export function LanguageSwitch({ lang }: { lang: Locale }) {
  const t = copyFor(lang).language;
  return (
    <form method="post" action="/api/language" aria-label={t.label} className="flex gap-0.5 rounded-md border border-border p-0.5">
      {LOCALES.map((l) => {
        const name = copyFor(l).language.names[l];
        return (
          <button
            key={l}
            type="submit"
            name="lang"
            value={l}
            lang={l}
            aria-label={name}
            title={name}
            aria-pressed={l === lang}
            className="inline-flex h-7 min-w-8 items-center justify-center rounded-[4px] px-1.5 opacity-60 hover:opacity-100 aria-pressed:bg-surface aria-pressed:opacity-100 aria-pressed:shadow-[inset_0_0_0_1px_var(--line)]"
          >
            <Flag locale={l} />
          </button>
        );
      })}
    </form>
  );
}
