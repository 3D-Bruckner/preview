import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { customerModel } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatDay } from "@/components/format";
import { ModelViewer } from "@/components/ModelViewer";
import { ui } from "@/components/ui";

type Props = PageProps<"/[lang]/k/[token]/[model]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, model } = await params;
  const view = customerModel(runtime(), token, model);
  return view ? { title: view.model.title } : {};
}

// One model of a customer's: the 3D view of the picked version (the newest unless ?v=<number> picks another), the versions with their
// notes, and the picked version's drawings shown in the page. Nothing here is a download: no download attribute, and only a PDF drawing
// is a link, which the browser opens in its own viewer. A model that is not the token's customer's is the same 404 as any missing page.
export default async function CustomerModelPage({ params, searchParams }: Props) {
  const { lang, token, model } = await params;
  const view = customerModel(runtime(), token, model);
  if (!view) notFound();
  const t = copyFor(lang).customer;
  const asked = Number((await searchParams).v);
  const shown = view.versions.find((v) => v.number === asked) ?? view.versions[0]!;
  return (
    <>
      <Link href={`/k/${token}`} className="text-sm text-muted underline hover:text-ink">
        {t.allModels}
      </Link>
      <h1 className={`${ui.h1} mt-2`}>{view.model.title}</h1>
      {view.model.description && <p className="mt-2 text-muted">{view.model.description}</p>}

      <ModelViewer src={shown.threemfUrl} label={t.viewer(view.model.title)} />

      <section aria-labelledby="versions" className="mt-6">
        <h2 id="versions" className={ui.h2}>
          {t.versions}
        </h2>
        <ol className="mt-2 divide-y divide-border rounded-xl border border-border">
          {view.versions.map((v) => {
            const current = v.number === shown.number;
            return (
              <li key={v.number}>
                <Link
                  href={`/k/${token}/${view.model.id}?v=${v.number}`}
                  aria-current={current ? "page" : undefined}
                  className={`block px-4 py-3 hover:bg-surface ${current ? "bg-surface" : ""}`}
                >
                  <span className={`block ${current ? "font-semibold" : ""}`}>
                    {t.version(v.number)}
                    {" · "}
                    <time dateTime={v.createdAt}>{formatDay(lang, v.createdAt)}</time>
                    {current && <span className="ml-2 text-sm font-normal text-muted">{t.shown}</span>}
                  </span>
                  {v.note && <span className="mt-0.5 block text-sm text-muted">{v.note}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {shown.drawings.length > 0 && (
        <section aria-labelledby="drawings" className="mt-6">
          <h2 id="drawings" className={ui.h2}>
            {t.drawings}
          </h2>
          <ul className="mt-2 space-y-3">
            {/* Shown with <img> only, never inlined into the page: a stored SVG may carry script. */}
            {shown.drawings.map((d, i) => (
              <li key={d.url}>
                {d.kind === "pdf" ? (
                  <a href={d.url} target="_blank" rel="noopener" className="underline">
                    {t.pdf(i + 1)}
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- the customer's own file route, private; an SVG must stay an <img>
                  <img src={d.url} alt={t.drawing(i + 1)} loading="lazy" className="w-full rounded-xl border border-border bg-white" />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
