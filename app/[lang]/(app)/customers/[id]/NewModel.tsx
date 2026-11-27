"use client";
import { useActionState, useId } from "react";
import { useCopy } from "@/components/CopyProvider";
import { AddIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { addModel } from "../../actions";

// A new model for the customer; saving opens its page, where the first version is uploaded.
export function NewModel({ customerId }: { customerId: string }) {
  const t = useCopy().admin.customer;
  const headingId = useId();
  const [result, submit, pending] = useActionState(addModel, null);
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className={ui.h2}>
        {t.addModel}
      </h2>
      <form action={submit} className="mt-3 space-y-3">
        <input type="hidden" name="customerId" value={customerId} />
        <label className="block">
          <span className={ui.label}>{t.modelTitle}</span>
          <input name="title" required maxLength={160} className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>{t.modelDescription}</span>
          <textarea name="description" rows={2} maxLength={4000} className={ui.input} />
          <span className={ui.hint}>{t.modelDescriptionHint}</span>
        </label>
        <button type="submit" disabled={pending} className={ui.button}>
          <AddIcon aria-hidden="true" className={ui.iconSize} />
          {t.createModel}
        </button>
        <Notice result={result} />
      </form>
    </section>
  );
}
