import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, getModel, listFeedback, listVersions, markFeedbackSeen } from "@/backend";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatGrams, formatSeen, hoursMinutes } from "@/components/format";
import { CrumbIcon, OpenLinkIcon, ShownIcon } from "@/components/icons";
import { ui } from "@/components/ui";
import { CopyModelLink, EditModel } from "./ModelDetails";
import { Reslice } from "./Reslice";
import { UploadVersion } from "./UploadVersion";

export async function generateMetadata({ params }: PageProps<"/[lang]/models/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  // Signed out, the title must not name the model: the redirect's body carries the metadata.
  if (!(await runtime().person(await headers()))) return { title: copyFor(lang).home.title };
  const m = getModel(runtime(), id);
  return { title: m.ok ? m.value.title : copyFor(lang).home.title };
}

// One model: its title (the pencil edits it and the description), "Wie <Name> es sieht" and the model's link; its versions, newest first,
// as cards with the picture, the note, the print figures, when the customer last viewed it and the feedback on it (marked seen once shown
// here, still flagged "neu" this once; the links here are prefetch={false}, so only opening the page marks it); beside them the upload of
// the next version.
export default async function ModelAdminPage({ params, searchParams }: PageProps<"/[lang]/models/[id]">) {
  const { lang, id } = await params;
  await requirePerson(`/models/${id}`);
  const rt = runtime();
  const model = getModel(rt, id);
  if (!model.ok) notFound();
  const m = model.value;
  const customer = getCustomer(rt, m.customerId);
  const versions = listVersions(rt, id);
  if (!customer.ok || !versions.ok) notFound();
  const c = customer.value;
  const all = copyFor(lang);
  const t = all.admin.model;
  const feedback = listFeedback(rt, { modelId: id });
  const fresh = feedback.filter((x) => !x.seenAt).map((x) => x.id);
  if (fresh.length > 0) markFeedbackSeen(rt, fresh);
  const f = t.figures;
  const link = c.link ? `${rt.config.publicUrl}/k/${c.link}/${m.id}` : null;
  const first = c.name.split(/\s+/)[0] ?? c.name;
  const failedBefore = (await searchParams).upload === "failed" && versions.value.length === 0;
  return (
    <>
      <nav aria-label={t.crumbs} className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <Link href="/" className="underline underline-offset-3 hover:text-ink">
          {t.customers}
        </Link>
        <CrumbIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <Link href={`/customers/${c.id}`} className="truncate underline underline-offset-3 hover:text-ink">
          {c.name}
        </Link>
        <CrumbIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{m.title}</span>
      </nav>
      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className={`${ui.h1} break-words md:text-[2.25rem]`}>{m.title}</h1>
            <EditModel model={{ id: m.id, title: m.title, description: m.description ?? "" }} />
          </div>
          {m.description && <p className="mt-2 max-w-[42rem] text-muted">{m.description}</p>}
        </div>
        {link ? (
          <div className="flex flex-wrap items-start gap-2">
            <a href={link} target="_blank" rel="noreferrer" className={`${ui.secondary} min-h-10 px-3 text-sm`}>
              <OpenLinkIcon aria-hidden="true" className={ui.iconSize} />
              {t.asCustomer(first)}
            </a>
            <CopyModelLink url={link} />
          </div>
        ) : (
          <p className="text-sm text-muted">{t.noCustomerLink}</p>
        )}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="versions" className="min-w-0">
          <h2 id="versions" className={`${ui.h2} mb-3`}>
            {t.versions} <span className="text-sm font-normal text-muted tabular">{versions.value.length}</span>
          </h2>
          {versions.value.length === 0 ? (
            <p className="text-muted">{t.noVersions}</p>
          ) : (
            <ol className="grid gap-4">
              {versions.value.map((v, i) => {
                const own = feedback.filter((x) => x.versionId === v.id);
                const time = v.figures && hoursMinutes(v.figures.seconds);
                return (
                  <li key={v.id} className="overflow-hidden rounded-md border border-border bg-paper">
                    <div className="grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a private file behind the session */}
                      <img
                        src={`/api/versions/${v.id}/preview`}
                        alt={t.versionPreview(v.number)}
                        loading="lazy"
                        className="aspect-square w-full max-w-[160px] rounded-md border border-border bg-surface object-contain sm:w-[120px]"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h3 className="font-semibold">
                            {all.admin.customer.version(v.number)}
                            <span className="ml-2 text-sm font-normal text-muted">
                              <time dateTime={v.createdAt}>{formatSeen(lang, v.createdAt)}</time>
                            </span>
                            {i === 0 && <span className="ml-2 rounded-full border border-line px-2 text-xs font-medium">{t.newest}</span>}
                          </h3>
                          <span title={t.seenHint} className="inline-flex items-center gap-1.5 text-sm text-muted">
                            <ShownIcon aria-hidden="true" className="size-4" />
                            {v.seenAt ? t.seenBy(first, formatSeen(lang, v.seenAt)) : t.notSeenBy(first)}
                          </span>
                        </div>
                        {v.note && <p className="mt-1">{v.note}</p>}
                        {v.figures && time && (
                          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular">
                            <div>
                              <dt className="text-xs text-muted">{t.printTime}</dt>
                              <dd className="font-semibold">{all.customer.print.duration(time.h, time.m)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted">{t.weight}</dt>
                              <dd className="font-semibold">
                                {formatGrams(v.figures.grams, lang)} {all.customer.print.g}
                              </dd>
                            </div>
                          </dl>
                        )}
                        {(v.figures || v.drawings.length > 0) && (
                          <p className="mt-1 text-[0.8125rem] text-muted">
                            {[v.figures && (v.figures.source === "file" ? f.file : f.slicer), v.drawings.length > 0 && t.drawings(v.drawings.length)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        {v.slicing === "pending" && <p className="mt-2 text-sm text-muted">{f.pending}</p>}
                        {v.slicing === "failed" && (
                          <>
                            <p className="mt-2 text-sm text-danger">{f.failed(f.reasons[v.reason ?? ""] ?? f.other(v.reason ?? ""))}</p>
                            <Reslice versionId={v.id} />
                          </>
                        )}
                      </div>
                    </div>
                    {own.length > 0 && (
                      <ul className="divide-y divide-border border-t border-border">
                        {own.map((x) => (
                          <li key={x.id} className={`px-4 py-3 text-sm ${x.seenAt ? "" : "bg-[color-mix(in_oklab,var(--accent)_7%,var(--bg))]"}`}>
                            <span className="flex flex-wrap items-center gap-2 font-semibold">
                              {t.feedback.from(x.customerName, formatSeen(lang, x.createdAt))}
                              {!x.seenAt && <span className="rounded-full border border-accent px-2 text-xs font-semibold text-accent">{t.feedback.new}</span>}
                            </span>
                            {x.comment && <p className="mt-1 whitespace-pre-line">{x.comment}</p>}
                            {x.wishes.length > 0 && (
                              <ul aria-label={t.wishes} className="mt-2 flex flex-wrap gap-2">
                                {x.wishes.map((w) => (
                                  <li
                                    key={w.part}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[0.8125rem]"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.45)]"
                                      style={{ background: w.filament.color }}
                                    />
                                    {t.feedback.wish(w.partName ?? w.part, w.filament.name, w.filament.material, w.filament.color)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <div className="lg:sticky lg:top-4">
          <UploadVersion modelId={m.id} failedBefore={failedBefore} />
        </div>
      </div>
    </>
  );
}
