"use client";
import { useActionState, useId } from "react";
import { useCopy } from "@/components/CopyProvider";
import { AddIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { addCustomer } from "./actions";

// A new customer: a name, a note for the workshop, the language of their page. Saving opens the customer's page, where their link is.
export function NewCustomer() {
  const t = useCopy().admin.customers;
  const headingId = useId();
  const [result, submit, pending] = useActionState(addCustomer, null);
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className={ui.h2}>
        {t.add}
      </h2>
      <form action={submit} className="mt-3 space-y-3">
        <CustomerFields />
        <button type="submit" disabled={pending} className={ui.button}>
          <AddIcon aria-hidden="true" className={ui.iconSize} />
          {t.create}
        </button>
        <Notice result={result} />
      </form>
    </section>
  );
}

/** The customer's fields, for the new-customer form and the edit form alike. */
export function CustomerFields({ name = "", note = "", language = "de" }: { name?: string; note?: string; language?: string }) {
  const t = useCopy();
  const c = t.admin.customers;
  return (
    <>
      <label className="block">
        <span className={ui.label}>{c.name}</span>
        <input name="name" required maxLength={120} defaultValue={name} className={ui.input} />
      </label>
      <label className="block">
        <span className={ui.label}>{c.note}</span>
        <textarea name="note" rows={3} maxLength={2000} defaultValue={note} className={ui.input} />
        <span className={ui.hint}>{c.noteHint}</span>
      </label>
      <label className="block">
        <span className={ui.label}>{c.language}</span>
        <select name="language" defaultValue={language} className={ui.input}>
          <option value="de">{t.language.names.de}</option>
          <option value="en">{t.language.names.en}</option>
        </select>
      </label>
    </>
  );
}
