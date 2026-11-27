import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { CSSProperties } from "react";
import { documentMetadata, VIEWPORT } from "@/app/_lib/document";
import { runtime } from "@/app/_lib/runtime";
import { BrandFooter } from "@/components/BrandFooter";
import { LANG_COOKIE, negotiate } from "@/components/copy";
import { NotFound } from "@/components/NotFound";
import "@fontsource-variable/archivo";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";

// An address no route matches: the root layout sits in app/[lang], so there is none to compose this page from (Next's globalNotFound).
// Its own document, in the language the proxy would have picked, built like the root layout's around app/[lang]/not-found.tsx: a 404
// looks the same whether no route matched or a page (a customer link that opens nothing) answered notFound().
const language = async () => negotiate((await cookies()).get(LANG_COOKIE)?.value, (await headers()).get("accept-language"));

export async function generateMetadata(): Promise<Metadata> {
  return documentMetadata(await language());
}

export const viewport = VIEWPORT;

export default async function GlobalNotFound() {
  const lang = await language();
  const brand = runtime().config.brand;
  return (
    <html lang={lang} style={{ "--brand-accent": brand.accentColor } as CSSProperties}>
      <body className="flex min-h-screen flex-col bg-paper text-ink antialiased">
        <NotFound lang={lang} />
        <BrandFooter brand={brand} lang={lang} />
      </body>
    </html>
  );
}
