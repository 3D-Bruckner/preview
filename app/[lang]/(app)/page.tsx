import type { Metadata } from "next";
import Link from "next/link";
import { listFeedback } from "@/backend";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatSeen } from "@/components/format";
import { FeedbackIcon } from "@/components/icons";
import { ui } from "@/components/ui";
import { CustomerList } from "./CustomerList";
import { listedCustomers, split } from "./listed";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  return { title: copyFor((await params).lang).home.title };
}

// The start page for whoever runs the instance: the customers (the list, with "Neuer Kunde"), and beside them the feedback not seen yet,
// each a link to its model, where it is marked seen. On a phone the feedback comes first, then the list.
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  await requirePerson("/");
  const lang = (await params).lang;
  const t = copyFor(lang);
  const rt = runtime();
  const unseen = listFeedback(rt, { unseen: true });
  return (
    <div className={split}>
      <div className="order-2 md:order-1">
        <CustomerList customers={listedCustomers(rt)} heading="h1" />
      </div>
      <div className="order-1 grid gap-4 md:order-2">
        {unseen.length > 0 && (
          <section aria-labelledby="new-feedback" className={`${ui.card} border-accent`}>
            <h2 id="new-feedback" className={`${ui.h2} flex items-center gap-2`}>
              <FeedbackIcon aria-hidden="true" className="size-4 text-accent" />
              {t.home.feedbackTitle}
              <span className="text-sm font-normal text-muted">{t.home.feedback(unseen.length)}</span>
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {unseen.map((f) => (
                <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <Link href={`/models/${f.modelId}`} prefetch={false} className="text-accent underline underline-offset-3">
                    {t.home.feedbackItem(f.customerName, f.modelTitle, f.versionNumber)}
                  </Link>
                  <time dateTime={f.createdAt} className="text-sm text-muted">
                    {formatSeen(lang, f.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="hidden rounded-md border border-dashed border-line p-6 text-center text-muted md:block">{t.admin.customers.pick}</p>
      </div>
    </div>
  );
}
