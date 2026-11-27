import { runtime } from "@/app/_lib/runtime";
import { BrandName } from "@/components/BrandName";
import { isLocale } from "@/components/copy";
import { LanguageSwitch } from "@/components/LanguageSwitch";

// The customer pages' frame (/k/<token>…, no sign-in): the brand's logo and name, and the language switch, the one thing on these pages
// that sets a cookie. The logo comes from its own route (app/brand/logo), never by its path on disk; the footer is the root layout's.
export default async function CustomerLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const brand = runtime().config.brand;
  return (
    <>
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-safe py-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* The name beside it says what it is, so the logo is decoration. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- the logo's own route; an SVG must stay an <img> */}
            {brand.logo && <img src="/brand/logo" alt="" className="h-8 w-auto" />}
            <BrandName brand={brand} className="font-display font-bold tracking-tight" />
          </div>
          {isLocale(lang) && <LanguageSwitch lang={lang} />}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-safe pt-5 pb-8">{children}</main>
    </>
  );
}
