import { headers } from "next/headers";
import { runtime } from "@/app/_lib/runtime";
import { BrandName } from "@/components/BrandName";
import { isLocale } from "@/components/copy";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { NavLinks } from "./NavLinks";

// The signed-in pages' frame: the brand's name, the menu (a tab bar at the bottom) and the language switch. Each page asks for its person
// itself (requirePerson); the menu shows only to someone signed in.
export default async function AppLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const rt = runtime();
  const person = await rt.person(await headers());
  return (
    <>
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-safe py-2">
          <BrandName brand={rt.config.brand} className="font-display font-bold tracking-tight" />
          {isLocale(lang) && <LanguageSwitch lang={lang} />}
        </div>
      </header>
      <main className={`mx-auto w-full max-w-3xl flex-1 px-safe pt-5 ${person ? "pb-[calc(var(--tabbar)+2rem)]" : "pb-8"}`}>{children}</main>
      {/* The menu is a tab bar at the bottom, where the thumb is. */}
      {person && <NavLinks />}
    </>
  );
}
