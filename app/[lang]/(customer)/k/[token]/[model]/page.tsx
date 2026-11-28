import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { customerModel, recordView } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatDay } from "@/components/format";
import { CrumbIcon, OpenIcon } from "@/components/icons";
import { Card } from "@/components/Card";
import { ModelReview } from "@/components/ModelReview";
import { PrintFigures } from "@/components/PrintFigures";
import { Feedback } from "./Feedback";
import { ui } from "@/components/ui";

type Props = PageProps<"/[lang]/k/[token]/[model]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, model } = await params;
  const view = customerModel(runtime(), token, model);
  return view ? { title: view.model.title } : {};
}

// One model of a customer's: the 3D view of the picked version (the newest unless ?v=<number> picks another), Maße and Druck under it, the
// drawings, and beside it the parts with their colour pickers and the Rückmeldung card (ModelReview); under 1024 px it all stacks. One
// version picker by the title, and what is new in the shown version under it. Nothing here is a download: no download attribute, and only
// a PDF drawing is a link, which the browser opens in its own viewer. A model that is not the token's customer's is the same 404 as any
// missing page. A look by the customer is recorded (recordView); one by someone signed in to the web app is not, and the version links
// don't prefetch, which would count as a look.
export default async function CustomerModelPage({ params, searchParams }: Props) {
  const { lang, token, model } = await params;
  const rt = runtime();
  const view = customerModel(rt, token, model);
  if (!view) notFound();
  const t = copyFor(lang).customer;
  const asked = Number((await searchParams).v);
  const shown = view.versions.find((v) => v.number === asked) ?? view.versions[0]!;
  if (!(await rt.person(await headers()))) recordView(rt, token, shown.id);
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
          {view.model.description && <p className="mt-2 max-w-[42rem] text-muted">{view.model.description}</p>}
          {shown.note && view.versions.length > 1 && (
            <p className="mt-2 max-w-[42rem]">
              <b className="font-semibold">{t.newIn(shown.number)}</b> {shown.note}
            </p>
          )}
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
            className="absolute right-0 z-10 mt-1 min-w-72 overflow-hidden rounded-md border border-border bg-paper py-1 text-sm shadow-md"
          >
            {view.versions.map((v) => (
              <li key={v.number}>
                <Link
                  href={href(v.number)}
                  prefetch={false}
                  aria-current={v.number === shown.number ? "page" : undefined}
                  className={`block px-3 py-2 hover:bg-surface ${v.number === shown.number ? "font-semibold" : ""}`}
                >
                  <span className="tabular">
                    {t.version(v.number)}
                    {" · "}
                    {when(v.createdAt)}
                  </span>
                  {v.note && <span className="block text-[0.8125rem] font-normal text-muted">{v.note}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* Keyed by the file: another version starts the review over (whole model, nothing picked). */}
      <ModelReview
        key={shown.threemfUrl}
        src={shown.threemfUrl}
        label={t.viewer(view.model.title)}
        facts={shown.facts}
        print={<PrintFigures lang={lang} figures={shown.figures} pending={shown.printPending} />}
        filaments={view.filaments}
        below={
          shown.drawings.length > 0 && (
            <Card id="drawings" title={t.drawings} aside={shown.drawings.length}>
              <ul className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
                {/* Shown with <img> only, never inlined into the page: a stored SVG may carry script. */}
                {shown.drawings.map((d, i) => (
                  <li key={d.url} className={d.kind === "pdf" ? "col-span-full" : ""}>
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
          )
        }
      >
        <Feedback
          token={token}
          modelId={view.model.id}
          versionNumber={shown.number}
          sent={shown.feedback.map((f) => ({
            createdAt: f.createdAt,
            day: formatDay(lang, f.createdAt),
            comment: f.comment,
            wishes: f.wishes.map((w) => ({ part: w.part, partName: w.partName, name: w.filament.name, material: w.filament.material })),
          }))}
        />
      </ModelReview>
    </>
  );
}
