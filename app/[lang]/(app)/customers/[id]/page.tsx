import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, listModels, listVersions } from "@/backend";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { ui } from "@/components/ui";
import { CustomerDetails } from "./CustomerDetails";
import { LinkPanel } from "./LinkPanel";
import { NewModel } from "./NewModel";

export async function generateMetadata({ params }: PageProps<"/[lang]/customers/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  // Signed out, the title must not name the customer: the redirect's body carries the metadata.
  if (!(await runtime().person(await headers()))) return { title: copyFor(lang).home.title };
  const c = getCustomer(runtime(), id);
  return { title: c.ok ? c.value.name : copyFor(lang).home.title };
}

// One customer: their details, their link (copy, renew, revoke) and their models.
export default async function CustomerAdminPage({ params }: PageProps<"/[lang]/customers/[id]">) {
  const { lang, id } = await params;
  await requirePerson(`/customers/${id}`);
  const rt = runtime();
  const customer = getCustomer(rt, id);
  if (!customer.ok) notFound();
  const c = customer.value;
  const t = copyFor(lang).admin.customer;
  const models = listModels(rt, { customerId: id }).map((m) => {
    const versions = listVersions(rt, m.id);
    return { model: m, newest: versions.ok ? (versions.value[0]?.number ?? null) : null };
  });
  return (
    <>
      <p>
        <Link href="/" className="text-sm text-accent underline">
          {t.back}
        </Link>
      </p>
      <h1 className={`${ui.h1} mt-2`}>{c.name}</h1>
      <LinkPanel customerId={c.id} url={c.link ? `${rt.config.publicUrl}/k/${c.link}` : null} />
      <CustomerDetails customer={{ id: c.id, name: c.name, note: c.note ?? "", language: c.language }} />
      <section aria-labelledby="models" className="mt-8">
        <h2 id="models" className={ui.h2}>
          {t.models}
        </h2>
        {models.length === 0 ? (
          <p className="mt-2 text-muted">{t.noModels}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {models.map(({ model, newest }) => (
              <li key={model.id}>
                <Link href={`/models/${model.id}`} className="flex min-h-11 flex-col p-3 hover:bg-surface">
                  <span className="font-medium">{model.title}</span>
                  <span className="text-sm text-muted">{newest === null ? t.noVersion : t.version(newest)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NewModel customerId={c.id} />
    </>
  );
}
