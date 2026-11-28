import { headers } from "next/headers";
import { runtime } from "@/app/_lib/runtime";
import { logoFile } from "@/backend";
import { currentTheme } from "@/app/_lib/theme";
import { isLocale } from "@/components/copy";
import { SiteHeader } from "@/components/SiteHeader";
import { NavLinks } from "./NavLinks";

// The signed-in pages' frame: the shared header (wide, for a desktop), the menu (a row under the header from 768 px, a tab bar at the
// bottom on a phone) and the page. Each page asks for its person itself (requirePerson); the menu shows only to someone signed in.
export default async function AppLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const rt = runtime();
  const person = await rt.person(await headers());
  return (
    <>
      {isLocale(lang) && <SiteHeader brand={rt.config.brand} logo={!!logoFile(rt.config)} lang={lang} theme={await currentTheme()} width="wide" />}
      {person && <NavLinks />}
      <main className={`mx-auto w-full max-w-[1240px] flex-1 px-safe pt-5 md:px-8 md:pt-7 ${person ? "pb-[calc(var(--tabbar)+2rem)] md:pb-10" : "pb-8"}`}>
        {children}
      </main>
    </>
  );
}
