"use client";
import { useActionState, useId } from "react";
import { useCopy } from "@/components/CopyProvider";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { saveModel } from "../../actions";

// The model's title and the description the customer sees under it.
export function ModelDetails({ model }: { model: { id: string; title: string; description: string } }) {
  const t = useCopy().admin;
  const headingId = useId();
  const [result, submit, pending] = useActionState(saveModel, null);
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className={ui.h2}>
        {t.model.details}
      </h2>
      <form action={submit} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={model.id} />
        <label className="block">
          <span className={ui.label}>{t.customer.modelTitle}</span>
          <input name="title" required maxLength={160} defaultValue={model.title} className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>{t.customer.modelDescription}</span>
          <textarea name="description" rows={2} maxLength={4000} defaultValue={model.description} className={ui.input} />
          <span className={ui.hint}>{t.customer.modelDescriptionHint}</span>
        </label>
        <button type="submit" disabled={pending} className={ui.button}>
          {t.customer.save}
        </button>
        <Notice result={result} />
      </form>
    </section>
  );
}
