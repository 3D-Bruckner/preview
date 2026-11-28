import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, listFeedback, listModels, listVersions, modelSeenAt } from "@/backend";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatSeen } from "@/components/format";
import { CrumbIcon } from "@/components/icons";
import { CustomerList } from "../../CustomerList";
import { listedCustomers, split } from "../../listed";
import { EditCustomer } from "./CustomerDetails";
import { LinkPanel } from "./LinkPanel";
import { NewModel } from "./NewModel";

export async function generateMetadata({ params }: PageProps<"/[lang]/customers/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  // Signed out, the title must not name the customer: the redirect's body carries the metadata.
  if (!(await runtime().person(await headers()))) return { title: copyFor(lang).home.title };
  const c = getCustomer(runtime(), id);
  return { title: c.ok ? c.value.name : copyFor(lang).home.title };
}

// One customer, beside the customer list on a desktop (alone on a phone): one card with their name and note (the pencil edits them), their
// link (copy, open, renew, revoke; send by WhatsApp or mail; when they last looked), their models (each with its newest version, when the
// customer last viewed it and its feedback) and a new model with its first 3MF.
export default async function CustomerAdminPage({ params }: PageProps<"/[lang]/customers/[id]">) {
  const { lang, id } = await params;
  await requirePerson(`/customers/${id}`);
  const rt = runtime();
  const customer = getCustomer(rt, id);
  if (!customer.ok) notFound();
  const c = customer.value;
  const t = copyFor(lang).admin.customer;
  const feedback = listFeedback(rt, { customerId: id });
  const models = listModels(rt, { customerId: id }).map((m) => {
    const versions = listVersions(rt, m.id);
    const newest = versions.ok ? versions.value[0] : undefined;
    const own = feedback.filter((f) => f.modelId === m.id);
    return { model: m, newest, seen: modelSeenAt(rt, m.id), feedback: own.length, unseen: own.filter((f) => !f.seenAt).length };
  });
  const url = c.link ? `${rt.config.publicUrl}/k/${c.link}` : null;
  // The message goes to the customer, so it is in their language.
  const theirs = copyFor(c.language).admin.customer;
  const first = c.name.split(/\s+/)[0] ?? c.name;
  return (
    <div className={split}>
      <div className="hidden md:block">
        <CustomerList customers={listedCustomers(rt)} selected={c.id} heading="h2" />
      </div>
      <article className="min-w-0 overflow-hidden rounded-md border border-border bg-paper">
        <nav aria-label={copyFor(lang).admin.model.crumbs} className="px-4 pt-3 text-sm text-muted md:hidden">
          <Link href="/" className="underline underline-offset-3">
            {t.back}
          </Link>
        </nav>
        <header className="flex items-start justify-between gap-3 px-4 py-4 md:px-5">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight break-words md:text-[1.75rem]">{c.name}</h1>
            {c.note && <p className="mt-1 text-muted">{c.note}</p>}
          </div>
          <EditCustomer customer={{ id: c.id, name: c.name, note: c.note ?? "", language: c.language }} />
        </header>
        <LinkPanel
          customerId={c.id}
          name={first}
          url={url}
          share={url ? { subject: theirs.shareSubject, text: theirs.shareText(first, url) } : null}
          seen={c.lastSeenAt ? t.seen(first, formatSeen(lang, c.lastSeenAt)) : t.neverSeen(first)}
        />
        <section aria-labelledby="models" className="border-t border-border">
          <h2 id="models" className="flex items-baseline gap-2 px-4 pt-4 text-sm font-semibold md:px-5">
            {t.models} <span className="font-normal text-muted tabular">{models.length}</span>
          </h2>
          {models.length === 0 ? (
            <p className="px-4 py-3 text-muted md:px-5">{t.noModels}</p>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t border-border">
              {models.map(({ model, newest, seen, feedback: count, unseen }) => (
                <li key={model.id}>
                  <Link href={`/models/${model.id}`} prefetch={false} className="flex items-center gap-3 px-4 py-3 hover:bg-surface md:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{model.title}</span>
                      <span className="block text-sm text-muted">
                        {newest
                          ? [
                              `${t.version(newest.number)} · ${formatSeen(lang, newest.createdAt)}`,
                              newest.parts !== null ? copyFor(lang).customer.partCount(newest.parts) : null,
                              seen ? t.modelSeen(formatSeen(lang, seen)) : t.modelNotSeen,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : t.noVersion}
                      </span>
                    </span>
                    {count > 0 && (
                      <span className="shrink-0 text-right text-sm">
                        <span className="block text-muted">{t.feedbackCount(count)}</span>
                        {unseen > 0 && <span className="block font-semibold text-accent">{t.feedbackNew(unseen)}</span>}
                      </span>
                    )}
                    <CrumbIcon aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <NewModel customerId={c.id} />
      </article>
    </div>
  );
}
