import type { Metadata } from "next";
import Link from "next/link";
import { listCustomers, listFeedback, listModels } from "@/backend";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatWhen } from "@/components/format";
import { ui } from "@/components/ui";
import { NewCustomer } from "./NewCustomer";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  return { title: copyFor((await params).lang).home.title };
}

// The start page for whoever runs the instance: the feedback not seen yet (each a link to its model, where it is marked seen), the
// customers, and a form for a new one.
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  await requirePerson("/");
  const lang = (await params).lang;
  const t = copyFor(lang);
  const rt = runtime();
  const customers = listCustomers(rt);
  const unseen = listFeedback(rt, { unseen: true });
  return (
    <>
      <h1 className={ui.h1}>{t.home.title}</h1>
      {unseen.length > 0 && (
        <section aria-labelledby="new-feedback" className="mt-4 rounded-md border-2 border-accent p-3">
          <h2 id="new-feedback" className={ui.h2}>
            {t.home.feedbackTitle}
            <span className="ml-2 text-sm font-normal text-muted">{t.home.feedback(unseen.length)}</span>
          </h2>
          <ul className="mt-2 space-y-1">
            {unseen.map((f) => (
              <li key={f.id}>
                <Link href={`/models/${f.modelId}`} prefetch={false} className="text-accent underline">
                  {t.home.feedbackItem(f.customerName, f.modelTitle, f.versionNumber)}
                </Link>
                <span className="ml-2 text-sm text-muted">
                  <time dateTime={f.createdAt}>{formatWhen(lang, f.createdAt)}</time>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {customers.length === 0 ? (
        <p className="mt-4 text-muted">{t.home.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {customers.map((c) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className="flex min-h-11 flex-col p-3 hover:bg-surface">
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-muted">
                  {t.admin.customers.models(listModels(rt, { customerId: c.id }).length)}
                  {!c.link && ` · ${t.admin.customers.noLink}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewCustomer />
    </>
  );
}
