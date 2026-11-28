"use client";
import Link from "next/link";
import { useState } from "react";
import { useCopy } from "@/components/CopyProvider";
import { Dialog } from "@/components/Dialog";
import { AddIcon, SearchIcon } from "@/components/icons";
import { ui } from "@/components/ui";
import { NewCustomerForm } from "./NewCustomer";

export type ListedCustomer = { id: string; name: string; models: number; unseen: number; noLink: boolean };

/**
 * The customers, the web app's left column on a desktop (its whole first page on a phone): a search by name, "Neuer Kunde" (a dialog),
 * and a row per customer with their models and the feedback they sent that is not seen yet, written out and dotted (not colour alone).
 * The open customer is marked (aria-current). `heading` is the page's h1 on the start page, an h2 beside a customer.
 */
export function CustomerList({ customers, selected, heading }: { customers: ListedCustomer[]; selected?: string; heading: "h1" | "h2" }) {
  const t = useCopy();
  const c = t.admin.customers;
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = customers.filter((x) => x.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const H = heading;
  return (
    <section aria-labelledby="customers" className="overflow-hidden rounded-md border border-border bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <H id="customers" className="font-display text-lg font-bold tracking-tight">
          {t.home.title} <span className="text-sm font-normal text-muted tabular">{customers.length}</span>
        </H>
        <button type="button" onClick={() => setAdding(true)} className={`${ui.button} min-h-9 px-3 text-sm`}>
          <AddIcon aria-hidden="true" className={ui.iconSize} />
          {c.add}
        </button>
      </div>
      {customers.length > 4 && (
        <div className="border-b border-border px-4 py-2.5">
          <label className="flex items-center gap-2 rounded-md border border-line bg-paper px-3">
            <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted" />
            <span className="sr-only">{c.search}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.search}
              className="min-h-10 w-full bg-transparent text-base outline-none md:text-sm"
            />
          </label>
        </div>
      )}
      {customers.length === 0 ? (
        <p className="px-4 py-4 text-muted">{t.home.empty}</p>
      ) : shown.length === 0 ? (
        <p className="px-4 py-4 text-muted">{c.noMatch}</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((x) => {
            const current = x.id === selected;
            return (
              <li key={x.id}>
                <Link
                  href={`/customers/${x.id}`}
                  aria-current={current ? "page" : undefined}
                  className={`relative flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface ${current ? "bg-surface before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${current ? "font-bold" : "font-semibold"}`}>{x.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {c.models(x.models)}
                      {x.noLink && ` · ${c.noLink}`}
                    </span>
                  </span>
                  {x.unseen > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                      {c.newFeedback(x.unseen)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={adding} title={c.add} onClose={() => setAdding(false)}>
        <NewCustomerForm onCancel={() => setAdding(false)} />
      </Dialog>
    </section>
  );
}
