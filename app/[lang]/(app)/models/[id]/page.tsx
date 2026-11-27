import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, getModel, listVersions } from "@/backend";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatWhen } from "@/components/format";
import { ui } from "@/components/ui";
import { ModelDetails } from "./ModelDetails";
import { UploadVersion } from "./UploadVersion";

export async function generateMetadata({ params }: PageProps<"/[lang]/models/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const m = getModel(runtime(), id);
  return { title: m.ok ? m.value.title : copyFor(lang).home.title };
}

// One model: its details, its versions (newest first) and the manual upload of the next one.
export default async function ModelAdminPage({ params }: PageProps<"/[lang]/models/[id]">) {
  const { lang, id } = await params;
  await requirePerson(`/models/${id}`);
  const rt = runtime();
  const model = getModel(rt, id);
  if (!model.ok) notFound();
  const m = model.value;
  const customer = getCustomer(rt, m.customerId);
  const versions = listVersions(rt, id);
  if (!customer.ok || !versions.ok) notFound();
  const t = copyFor(lang).admin.model;
  const link = customer.value.link ? `${rt.config.publicUrl}/k/${customer.value.link}/${m.id}` : null;
  return (
    <>
      <p>
        <Link href={`/customers/${customer.value.id}`} className="text-sm text-accent underline">
          {t.back(customer.value.name)}
        </Link>
      </p>
      <h1 className={`${ui.h1} mt-2`}>{m.title}</h1>
      <p className="mt-2 text-sm">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="text-accent underline">
            {t.customerLink}
          </a>
        ) : (
          <span className="text-muted">{t.noCustomerLink}</span>
        )}
      </p>
      <section aria-labelledby="versions" className="mt-6">
        <h2 id="versions" className={ui.h2}>
          {t.versions}
        </h2>
        {versions.value.length === 0 ? (
          <p className="mt-2 text-muted">{t.noVersions}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {versions.value.map((v) => (
              <li key={v.id} className="p-3">
                <span className="font-medium">{copyFor(lang).admin.customer.version(v.number)}</span>
                <span className="block text-sm text-muted">
                  <time dateTime={v.createdAt}>{formatWhen(lang, v.createdAt)}</time>
                  {v.drawings.length > 0 && ` · ${t.drawings(v.drawings.length)}`}
                </span>
                {v.note && <span className="mt-1 block">{v.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <UploadVersion modelId={m.id} />
      <ModelDetails model={{ id: m.id, title: m.title, description: m.description ?? "" }} />
    </>
  );
}
