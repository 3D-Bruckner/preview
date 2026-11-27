import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { customerView } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatDay } from "@/components/format";
import { ui } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/[lang]/k/[token]">): Promise<Metadata> {
  const { lang, token } = await params;
  const view = customerView(runtime(), token);
  return view ? { title: copyFor(lang).customer.title(view.customer.name) } : {};
}

// A customer's page, opened by their link: their models as tiles, each with the preview picture of its newest version (the 3MF loads
// only on a model's page). A token that opens nothing is the same 404 as any missing page.
export default async function CustomerPage({ params }: PageProps<"/[lang]/k/[token]">) {
  const { lang, token } = await params;
  const view = customerView(runtime(), token);
  if (!view) notFound();
  const t = copyFor(lang).customer;
  return (
    <>
      <h1 className={ui.h1}>{t.title(view.customer.name)}</h1>
      {view.models.length === 0 ? (
        <p className="mt-4 text-muted">{t.empty}</p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {view.models.map((m) => (
            <li key={m.id}>
              <Link href={`/k/${token}/${m.id}`} className="block overflow-hidden rounded-md border border-border bg-surface hover:border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- the customer's own file route, private */}
                <img src={m.latest.previewUrl} alt="" loading="lazy" className="aspect-square w-full bg-paper object-contain" />
                <span className="block p-3">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="block text-sm text-muted">
                    {t.version(m.latest.number)}
                    {" · "}
                    <time dateTime={m.latest.createdAt}>{formatDay(lang, m.latest.createdAt)}</time>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
