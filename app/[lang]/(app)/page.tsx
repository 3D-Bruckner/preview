import type { Metadata } from "next";
import Link from "next/link";
import { listCustomers, listModels } from "@/backend";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { ui } from "@/components/ui";
import { NewCustomer } from "./NewCustomer";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  return { title: copyFor((await params).lang).home.title };
}

// The start page for whoever runs the instance: the customers, and a form for a new one.
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  await requirePerson("/");
  const t = copyFor((await params).lang);
  const rt = runtime();
  const customers = listCustomers(rt);
  return (
    <>
      <h1 className={ui.h1}>{t.home.title}</h1>
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
