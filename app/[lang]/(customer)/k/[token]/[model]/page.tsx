import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { customerModel } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatDay } from "@/components/format";
import { CrumbIcon, OpenIcon } from "@/components/icons";
import { ModelViewer } from "@/components/ModelViewer";
import { ui } from "@/components/ui";

type Props = PageProps<"/[lang]/k/[token]/[model]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, model } = await params;
  const view = customerModel(runtime(), token, model);
  return view ? { title: view.model.title } : {};
}

/** A card of the side panel: a small heading row over a hairline, an optional muted count on the right. */
function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-md border border-border bg-paper">
      <h2 id={id} className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3 text-sm font-semibold">
        {title}
        {aside != null && <span className="text-[0.8125rem] font-normal text-muted tabular">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

// One model of a customer's: the 3D view of the picked version (the newest unless ?v=<number> picks another) beside a side panel with the
// versions and the picked version's drawings; under 1024 px it all stacks. A version picker by the title offers the same versions. Nothing
// here is a download: no download attribute, and only a PDF drawing is a link, which the browser opens in its own viewer. A model that is
// not the token's customer's is the same 404 as any missing page.
export default async function CustomerModelPage({ params, searchParams }: Props) {
  const { lang, token, model } = await params;
  const view = customerModel(runtime(), token, model);
  if (!view) notFound();
  const t = copyFor(lang).customer;
  const asked = Number((await searchParams).v);
  const shown = view.versions.find((v) => v.number === asked) ?? view.versions[0]!;
  const href = (n: number) => `/k/${token}/${view.model.id}?v=${n}`;
  const when = (iso: string) => <time dateTime={iso}>{formatDay(lang, iso)}</time>;
  return (
    <>
      <nav aria-label={t.breadcrumb} className="flex items-center gap-1.5 text-sm text-muted">
        <Link href={`/k/${token}`} className="underline underline-offset-3 hover:text-ink">
          {t.yourModels}
        </Link>
        <CrumbIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{view.model.title}</span>
      </nav>

      <div className="mt-3 mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={`${ui.h1} break-words md:text-[2.25rem]`}>{view.model.title}</h1>
          {view.model.description && <p className="mt-2 text-muted">{view.model.description}</p>}
        </div>
        {/* The version picker: a disclosure of links, so it works without JavaScript. */}
        <details className="relative">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-line bg-paper px-3 text-sm tabular [&::-webkit-details-marker]:hidden">
            <span className="font-semibold">
              {t.version(shown.number)}
              {" · "}
              {when(shown.createdAt)}
            </span>
            <OpenIcon aria-hidden="true" className="size-4 shrink-0" />
          </summary>
          <ul
            aria-label={t.chooseVersion}
            className="absolute right-0 z-10 mt-1 min-w-60 overflow-hidden rounded-md border border-border bg-paper py-1 text-sm"
          >
            {view.versions.map((v) => (
              <li key={v.number}>
                <Link
                  href={href(v.number)}
                  aria-current={v.number === shown.number ? "page" : undefined}
                  className={`block px-3 py-2 tabular hover:bg-surface ${v.number === shown.number ? "font-semibold" : ""}`}
                >
                  {t.version(v.number)}
                  {" · "}
                  {when(v.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ModelViewer src={shown.threemfUrl} label={t.viewer(view.model.title)} />

        <aside className="grid gap-4">
          <Card id="versions" title={t.versions} aside={view.versions.length}>
            <ol className="divide-y divide-border">
              {view.versions.map((v) => {
                const current = v.number === shown.number;
                return (
                  <li key={v.number}>
                    <Link href={href(v.number)} aria-current={current ? "page" : undefined} className="flex gap-3 px-4 py-2.5 hover:bg-surface">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full border-[1.5px] ${current ? "border-ink bg-ink" : "border-line"}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold tabular">
                          {t.version(v.number)}
                          {" · "}
                          {when(v.createdAt)}
                          {current && <span className="ml-2 rounded-full border border-line px-2 text-xs font-medium">{t.shown}</span>}
                        </span>
                        {v.note && <span className="mt-0.5 block text-[0.8125rem] text-muted">{v.note}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>

          {shown.drawings.length > 0 && (
            <Card id="drawings" title={t.drawings} aside={shown.drawings.length}>
              <ul className="grid grid-cols-2 gap-3 p-4">
                {/* Shown with <img> only, never inlined into the page: a stored SVG may carry script. */}
                {shown.drawings.map((d, i) => (
                  <li key={d.url} className={d.kind === "pdf" ? "col-span-2" : ""}>
                    {d.kind === "pdf" ? (
                      <a href={d.url} target="_blank" rel="noopener" className="text-sm underline">
                        {t.pdf(i + 1)}
                      </a>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- the customer's own file route, private; an SVG must stay an <img>
                      <img src={d.url} alt={t.drawing(i + 1)} loading="lazy" className="w-full rounded-md border border-border bg-white" />
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
