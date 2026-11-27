import { AutoThemeIcon, DarkIcon, LightIcon } from "@/components/icons";
import { copyFor, type Locale } from "@/components/copy";
import { THEMES, type Theme } from "@/components/theme";

const ICONS = { auto: AutoThemeIcon, light: LightIcon, dark: DarkIcon } as const;

// The header's theme switch: Auto (the system's), Light, Dark, as on the operator's site. It posts to /api/theme, which keeps the choice in
// a cookie and sends the browser back; the root layout sets data-theme from it. On a phone only the icons show; the names stay for screen
// readers.
export function ThemeSwitch({ lang, theme }: { lang: Locale; theme: Theme }) {
  const t = copyFor(lang).theme;
  return (
    <form method="post" action="/api/theme" aria-label={t.label} className="flex items-center gap-3 text-sm text-muted">
      {THEMES.map((k) => {
        const Icon = ICONS[k];
        const on = k === theme;
        return (
          <button
            key={k}
            type="submit"
            name="theme"
            value={k}
            aria-pressed={on}
            className={`inline-flex min-h-8 items-center gap-1.5 border-b-[1.5px] hover:text-ink ${on ? "border-ink text-ink" : "border-transparent"}`}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="sr-only sm:not-sr-only">{t[k]}</span>
          </button>
        );
      })}
    </form>
  );
}
