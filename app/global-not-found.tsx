import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { runtime } from "@/app/_lib/runtime";
import { copyFor, LANG_COOKIE, negotiate } from "@/components/copy";
import "./globals.css";

// An address no route matches: the root layout sits in app/[lang], so there is none to compose this page from (Next's globalNotFound).
// Its own document, in the language the proxy would have picked.
export function generateMetadata(): Metadata {
  return { title: runtime().config.brand.name, robots: { index: false, follow: false } };
}

export default async function GlobalNotFound() {
  const lang = negotiate((await cookies()).get(LANG_COOKIE)?.value, (await headers()).get("accept-language"));
  const t = copyFor(lang).notFound;
  return (
    <html lang={lang}>
      <body className="min-h-screen bg-white px-4 py-6 text-neutral-900 antialiased">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="mt-2">{t.text}</p>
        <Link href="/" className="mt-4 inline-block underline">
          {t.back}
        </Link>
      </body>
    </html>
  );
}
