"use client";
import { useActionState, useId } from "react";
import { useCopy } from "@/components/CopyProvider";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { saveCustomer } from "../../actions";
import { CustomerFields } from "../../NewCustomer";

// The customer's name, note and the language their page opens in.
export function CustomerDetails({ customer }: { customer: { id: string; name: string; note: string; language: string } }) {
  const t = useCopy().admin.customer;
  const headingId = useId();
  const [result, submit, pending] = useActionState(saveCustomer, null);
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className={ui.h2}>
        {t.details}
      </h2>
      <form action={submit} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={customer.id} />
        <CustomerFields name={customer.name} note={customer.note} language={customer.language} />
        <button type="submit" disabled={pending} className={ui.button}>
          {t.save}
        </button>
        <Notice result={result} />
      </form>
    </section>
  );
}
