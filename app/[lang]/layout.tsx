import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { runtime } from "@/app/_lib/runtime";
import { BrandFooter } from "@/components/BrandFooter";
import { CopyProvider } from "@/components/CopyProvider";
import { copyFor, isLocale } from "@/components/copy";
import "@fontsource-variable/archivo";
import "@fontsource-variable/hanken-grotesk";
import "../globals.css";

// The root layout. Its language is the page's, from proxy.ts's rewrite; no URL carries it (conventions: code/language). The brand (its
// name in the title, its accent colour, the footer's imprint and privacy links) is the instance's own, from its settings (backend/config.ts).
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const t = copyFor((await params).lang).app;
  const name = runtime().config.brand.name;
  return {
    title: { default: name, template: `%s · ${name}` },
    description: t.description,
    robots: { index: false, follow: false },
    // Added to the Home Screen it runs full-screen (the manifest says so too). Next writes mobile-web-app-capable for `capable`; older iOS
    // reads only the apple- name, so that one is added by hand.
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

// viewport-fit=cover lets the page reach under the notch and the home indicator; globals.css keeps the content out of them.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

// Every page is rendered per request and private: none is prerendered, so none goes out with a shared cache's s-maxage (the language
// comes from the request, and every page will be a signed-in person's).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const brand = runtime().config.brand;
  // The header and <main> are the route groups' own: (app) for the signed-in pages, (public) for sign-in and consent. The accent is the
  // setting's (globals.css derives the rest from it); the footer is every page's.
  return (
    <html lang={lang} style={{ "--brand-accent": brand.accentColor } as CSSProperties}>
      <body className="flex min-h-screen flex-col bg-paper text-ink antialiased">
        <CopyProvider lang={lang}>{children}</CopyProvider>
        <BrandFooter brand={brand} lang={lang} />
      </body>
    </html>
  );
}
