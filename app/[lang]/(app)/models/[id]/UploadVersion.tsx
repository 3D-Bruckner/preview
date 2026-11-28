"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useCopy } from "@/components/CopyProvider";
import { UploadIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { postVersion, uploadBody, VersionFields } from "@/components/VersionFields";
import type { Result } from "../../actions";

// Neue Version, beside the versions: the same multipart request the workshop's script sends, made with the signed-in session (the route
// accepts it). The picture is optional: the 3MF's own stands in. Needs JavaScript, as portfolio's forms do.
export function UploadVersion({ modelId, failedBefore = false }: { modelId: string; failedBefore?: boolean }) {
  const t = useCopy().admin;
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<Result | null>(failedBefore ? { ok: false, error: t.customer.createdNoVersion } : null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    const sent = await postVersion(modelId, uploadBody(e.currentTarget), t.model.failed);
    setSending(false);
    if (!sent.ok) return setResult(sent);
    setResult({ ok: true, message: t.model.uploaded(sent.number) });
    form.current?.reset();
    router.refresh();
  }

  return (
    <section aria-labelledby="upload" className={ui.card}>
      <h2 id="upload" className={ui.h2}>
        {t.model.newVersion}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.model.uploadHint}</p>
      <form ref={form} onSubmit={submit} className="mt-3 space-y-3">
        <VersionFields />
        <button type="submit" disabled={sending} className={`${ui.button} w-full`}>
          <UploadIcon aria-hidden="true" className={ui.iconSize} />
          {sending ? t.model.sending : t.model.send}
        </button>
        <Notice result={result} />
      </form>
    </section>
  );
}
