import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { customerView, recordView } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatDay, isRecent } from "@/components/format";
import { ChangedIcon, ModelsIcon } from "@/components/icons";
import { ui } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/[lang]/k/[token]">): Promise<Metadata> {
  const { lang, token } = await params;
  const view = customerView(runtime(), token);
  return view ? { title: copyFor(lang).customer.title(view.customer.name) } : {};
}

// A customer's page, opened by their link: their models as cards, each with the preview picture of its newest version (the 3MF loads only
// on a model's page), "new version" for a week after an upload, and the newest note. A token that opens nothing is the same 404 as any
// missing page. Opening it records that the customer looked (not for someone signed in); the cards don't prefetch, which would count as
// looking at a model.
export default async function CustomerPage({ params }: PageProps<"/[lang]/k/[token]">) {
  const { lang, token } = await params;
  const rt = runtime();
  const view = customerView(rt, token);
  if (!view) notFound();
  // The customer opened their link; a look by someone signed in to the web app is not theirs.
  if (!(await rt.person(await headers()))) recordView(rt, token);
  const t = copyFor(lang).customer;
  const now = new Date();
  const newest = view.models
    .map((m) => m.latest.createdAt)
    .sort()
    .at(-1);
  return (
    <>
      <p className="text-sm text-muted">{t.forName(view.customer.name)}</p>
      <h1 className={`${ui.h1} mt-1`}>{t.yourModels}</h1>
      <p className="mt-3 max-w-[38rem] text-[1.0625rem] text-muted">{t.lead}</p>
      {view.models.length === 0 ? (
        <p className="mt-6 text-muted">{t.empty}</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-muted">
            <li className="inline-flex items-center gap-2">
              <ModelsIcon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
              <strong className="font-semibold text-ink">{t.modelCount(view.models.length)}</strong>
            </li>
            {newest && (
              <li className="inline-flex items-center gap-2">
                <ChangedIcon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                <time dateTime={newest} className="font-semibold text-ink tabular">
                  {formatDay(lang, newest)}
                </time>
                {t.lastChanged}
              </li>
            )}
          </ul>
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {view.models.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/k/${token}/${m.id}`}
                  prefetch={false}
                  className="block h-full overflow-hidden rounded-md border border-border bg-paper hover:border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- the customer's own file route, private */}
                  <img src={m.latest.previewUrl} alt="" loading="lazy" className="aspect-[4/3] w-full border-b border-border bg-surface object-contain" />
                  <span className="block px-4 pt-3.5 pb-4">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[1.0625rem] font-semibold tracking-tight">{m.title}</span>
                      {isRecent(m.latest.createdAt, now) && (
                        <span className="shrink-0 rounded-full border border-line px-2 text-xs whitespace-nowrap">{t.newVersion}</span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-muted tabular">
                      {t.version(m.latest.number)}
                      {" · "}
                      <time dateTime={m.latest.createdAt}>{formatDay(lang, m.latest.createdAt)}</time>
                      {m.latest.parts ? (
                        <>
                          {" · "}
                          {t.partCount(m.latest.parts)}
                        </>
                      ) : null}
                    </span>
                    {m.latest.note && (
                      <span className="mt-2.5 block border-t border-border pt-2.5 text-sm">
                        <span className="text-muted">{t.latestNote}</span> {m.latest.note}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
