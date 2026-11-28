"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useCopy } from "@/components/CopyProvider";
import { AddIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { postVersion, uploadBody, VersionFields } from "@/components/VersionFields";
import { addModel, type Result } from "../../actions";

// A new model with its first version in one form: the 3MF (its name proposes the title), an own picture if wanted, the title and the
// description the customer sees. Saving creates the model, uploads the version and opens the model; when the upload fails the model is
// there and its page takes the upload again. Needs JavaScript, as the upload does.
export function NewModel({ customerId }: { customerId: string }) {
  const t = useCopy().admin;
  const router = useRouter();
  const title = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setResult(null);
    const fd = new FormData(form);
    const created = await addModel(fd).catch(() => ({ ok: false, error: t.model.failed }) as Result);
    if (!created.ok || !created.id) {
      setResult(created);
      setBusy(false);
      return;
    }
    const sent = await postVersion(created.id, uploadBody(form), t.model.failed);
    // A failed upload still opens the model, whose page says so and takes the upload again.
    router.push(sent.ok ? `/models/${created.id}` : `/models/${created.id}?upload=failed`);
  }

  return (
    <section aria-labelledby="new-model" className="border-t border-border px-4 py-4 md:px-5">
      <h2 id="new-model" className="text-sm font-semibold">
        {t.customer.addModel}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.customer.newModelHint}</p>
      <form onSubmit={submit} className="mt-3 grid gap-3 lg:grid-cols-2">
        <input type="hidden" name="customerId" value={customerId} />
        <div className="space-y-3">
          <VersionFields
            drawings={false}
            onModel={(file) => {
              if (file && title.current && !title.current.value) title.current.value = file.name.replace(/\.3mf$/i, "").replace(/[_-]+/g, " ");
            }}
          />
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className={ui.label}>{t.customer.modelTitle}</span>
            <input ref={title} name="title" required maxLength={160} className={ui.input} />
          </label>
          <label className="block">
            <span className={ui.label}>{t.customer.modelDescription}</span>
            <textarea name="description" rows={3} maxLength={4000} className={ui.input} />
            <span className={ui.hint}>{t.customer.modelDescriptionHint}</span>
          </label>
          <button type="submit" disabled={busy} className={ui.button}>
            <AddIcon aria-hidden="true" className={ui.iconSize} />
            {busy ? t.customer.creating : t.customer.createModel}
          </button>
          <Notice result={result} />
        </div>
      </form>
    </section>
  );
}
