import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { documentMetadata, VIEWPORT } from "@/app/_lib/document";
import { runtime } from "@/app/_lib/runtime";
import { BrandFooter } from "@/components/BrandFooter";
import { CopyProvider } from "@/components/CopyProvider";
import { isLocale } from "@/components/copy";
import { currentTheme } from "@/app/_lib/theme";
import "@fontsource-variable/archivo";
import "@fontsource-variable/hanken-grotesk";
import "../globals.css";

// The root layout. Its language is the page's, from proxy.ts's rewrite; no URL carries it (conventions: code/language). The brand (its
// name in the title, its accent colour, the footer's imprint and privacy links) is the instance's own, from its settings (backend/config.ts).
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  return documentMetadata((await params).lang);
}

export const viewport = VIEWPORT;

// Every page is rendered per request and private: none is prerendered, so none goes out with a shared cache's s-maxage (the language
// comes from the request, and every page will be a signed-in person's).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const brand = runtime().config.brand;
  // The theme switch's choice (components/ThemeSwitch.tsx): light and dark set data-theme, auto sets none and globals.css follows the system,
  // so the first paint is already right.
  const theme = await currentTheme();
  // The header and <main> are the route groups' own: (app) for the signed-in pages, (public) for sign-in and consent. The accent is the
  // setting's (globals.css derives the rest from it); the footer is every page's.
  return (
    <html lang={lang} data-theme={theme === "auto" ? undefined : theme} style={{ "--brand-accent": brand.accentColor } as CSSProperties}>
      <body className="flex min-h-screen flex-col bg-paper text-ink antialiased">
        <CopyProvider lang={lang}>{children}</CopyProvider>
        <BrandFooter brand={brand} lang={lang} />
      </body>
    </html>
  );
}
