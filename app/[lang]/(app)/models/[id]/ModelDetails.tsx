"use client";
import { useActionState, useState } from "react";
import { useCopy } from "@/components/CopyProvider";
import { Dialog } from "@/components/Dialog";
import { CopyIcon, EditIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { saveModel, type Result } from "../../actions";

// The pencil by the model's title: the title and the description the customer sees under it, in a dialog that closes once saved.
export function EditModel({ model }: { model: { id: string; title: string; description: string } }) {
  const t = useCopy();
  const [open, setOpen] = useState(false);
  const [result, submit, pending] = useActionState(async (prev: Result | null, fd: FormData) => {
    const r = await saveModel(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, null);
  return (
    <>
      <button type="button" aria-label={t.admin.model.edit} title={t.admin.model.edit} onClick={() => setOpen(true)} className={`${ui.icon} size-9 shrink-0`}>
        <EditIcon aria-hidden="true" className={ui.iconSize} />
      </button>
      <Dialog open={open} title={t.admin.model.edit} onClose={() => setOpen(false)}>
        <form action={submit} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={model.id} />
          <label className="block">
            <span className={ui.label}>{t.admin.customer.modelTitle}</span>
            <input name="title" required maxLength={160} defaultValue={model.title} className={ui.input} />
          </label>
          <label className="block">
            <span className={ui.label}>{t.admin.customer.modelDescription}</span>
            <textarea name="description" rows={3} maxLength={4000} defaultValue={model.description} className={ui.input} />
            <span className={ui.hint}>{t.admin.customer.modelDescriptionHint}</span>
          </label>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={ui.secondary}>
              {t.common.cancel}
            </button>
            <button type="submit" disabled={pending} className={ui.button}>
              {t.admin.customer.save}
            </button>
          </div>
          {result && !result.ok && <Notice result={result} />}
        </form>
      </Dialog>
    </>
  );
}

// Link kopieren for the model's own link (the customer's link, opened at this model).
export function CopyModelLink({ url }: { url: string }) {
  const t = useCopy().admin;
  const [result, setResult] = useState<Result | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(url).then(
            () => setResult({ ok: true, message: t.customer.copied }),
            () => setResult({ ok: false, error: t.customer.copyFailed }),
          )
        }
        className={`${ui.button} min-h-10 px-3 text-sm`}
      >
        <CopyIcon aria-hidden="true" className={ui.iconSize} />
        {t.model.copyLink}
      </button>
      <Notice result={result} />
    </span>
  );
}
