import type { Brand } from "@/backend";
import { BrandName } from "@/components/BrandName";
import type { Locale } from "@/components/copy";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import type { Theme } from "@/components/theme";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const WIDTH = { wide: "max-w-[1240px] md:px-8", narrow: "max-w-3xl" } as const;

// Every page's header, as on the operator's site: the logo (when set) and the brand's name on the left, the theme and language switches on
// the right, a hairline under it. The customer pages are wide, the web app and sign-in narrow. The logo comes from its own route
// (app/brand/logo), never by its path on disk; the name beside it says what it is, so the logo is decoration. data-width tells the
// root layout's footer (components/BrandFooter.tsx) how wide the page is.
export function SiteHeader({ brand, logo, lang, theme, width }: { brand: Brand; logo: boolean; lang: Locale; theme: Theme; width: keyof typeof WIDTH }) {
  return (
    <header data-width={width} className="border-b border-border bg-paper">
      <div className={`mx-auto flex min-h-14 items-center justify-between gap-4 px-safe py-2 md:min-h-16 ${WIDTH[width]}`}>
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- the logo's own route; an SVG must stay an <img> */}
          {logo && <img src="/brand/logo" alt="" className="h-8 w-auto" />}
          <BrandName brand={brand} className="truncate font-display text-lg font-black tracking-tight" />
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitch lang={lang} theme={theme} />
          <LanguageSwitch lang={lang} />
        </div>
      </div>
    </header>
  );
}
