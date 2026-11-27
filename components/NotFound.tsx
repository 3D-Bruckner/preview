import Link from "next/link";
import { copyFor } from "@/components/copy";

// The 404's words: the same for an address no route matches (app/global-not-found.tsx) and for a page that answers notFound()
// (app/[lang]/not-found.tsx), such as a customer link that opens nothing, so the two can't be told apart.
export function NotFound({ lang }: { lang: string }) {
  const t = copyFor(lang).notFound;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-safe py-6">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <p className="mt-2">{t.text}</p>
      <Link href="/" className="mt-4 inline-block underline">
        {t.back}
      </Link>
    </main>
  );
}
