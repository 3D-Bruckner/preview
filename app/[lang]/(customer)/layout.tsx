import { logoFile } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { currentTheme } from "@/app/_lib/theme";
import { isLocale } from "@/components/copy";
import { SiteHeader } from "@/components/SiteHeader";

// The customer pages' frame (/k/<token>…, no sign-in): the shared header, wide, and a wide main. The switches are the only things on these
// pages that set a cookie, and only when used; the footer is the root layout's.
export default async function CustomerLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const rt = runtime();
  return (
    <>
      {isLocale(lang) && <SiteHeader brand={rt.config.brand} logo={!!logoFile(rt.config)} lang={lang} theme={await currentTheme()} width="wide" />}
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-safe pt-6 pb-10 md:px-8">{children}</main>
    </>
  );
}
