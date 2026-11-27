import { logoFile } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { currentTheme } from "@/app/_lib/theme";
import { isLocale } from "@/components/copy";
import { SiteHeader } from "@/components/SiteHeader";

// The pages someone not signed in sees (sign-in, consent): the shared header, narrow.
export default async function PublicLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const rt = runtime();
  return (
    <>
      {isLocale(lang) && <SiteHeader brand={rt.config.brand} logo={!!logoFile(rt.config)} lang={lang} theme={await currentTheme()} width="narrow" />}
      <main className="flex-1 px-safe py-6">{children}</main>
    </>
  );
}
