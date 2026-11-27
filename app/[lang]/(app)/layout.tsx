import { headers } from "next/headers";
import { runtime } from "@/app/_lib/runtime";
import { logoFile } from "@/backend";
import { currentTheme } from "@/app/_lib/theme";
import { isLocale } from "@/components/copy";
import { SiteHeader } from "@/components/SiteHeader";
import { NavLinks } from "./NavLinks";

// The signed-in pages' frame: the shared header (narrow), and the menu as a tab bar at the bottom. Each page asks for its person
// itself (requirePerson); the menu shows only to someone signed in.
export default async function AppLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const rt = runtime();
  const person = await rt.person(await headers());
  return (
    <>
      {isLocale(lang) && <SiteHeader brand={rt.config.brand} logo={!!logoFile(rt.config)} lang={lang} theme={await currentTheme()} width="narrow" />}
      <main className={`mx-auto w-full max-w-3xl flex-1 px-safe pt-5 ${person ? "pb-[calc(var(--tabbar)+2rem)]" : "pb-8"}`}>{children}</main>
      {/* The menu is a tab bar at the bottom, where the thumb is. */}
      {person && <NavLinks />}
    </>
  );
}
