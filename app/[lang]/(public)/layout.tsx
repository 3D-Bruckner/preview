import { runtime } from "@/app/_lib/runtime";
import { BrandName } from "@/components/BrandName";
import { isLocale } from "@/components/copy";
import { LanguageSwitch } from "@/components/LanguageSwitch";

// The pages someone not signed in sees (sign-in, consent): the brand's name and the language switch.
export default async function PublicLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const brand = runtime().config.brand;
  return (
    <>
      <header className="border-b border-border">
        <div className="flex items-center justify-between px-safe py-3">
          <BrandName brand={brand} className="font-semibold" />
          {isLocale(lang) && <LanguageSwitch lang={lang} />}
        </div>
      </header>
      <main className="flex-1 px-safe py-6">{children}</main>
    </>
  );
}
