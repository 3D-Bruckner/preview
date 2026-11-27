"use client";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { useCopy } from "@/components/CopyProvider";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import type { Result } from "../../actions";

// The manual upload: the same multipart request the workshop's script sends, made with the signed-in session (the route accepts it).
// Needs JavaScript, as portfolio's forms do.
export function UploadVersion({ modelId }: { modelId: string }) {
  const t = useCopy().admin.model;
  const headingId = useId();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // An empty file input still sends a nameless, empty file: leave those out and keep the others.
    const drawings = fd.getAll("drawing");
    fd.delete("drawing");
    for (const file of drawings) if (file instanceof File && file.size > 0) fd.append("drawing", file);
    setSending(true);
    setResult(null);
    try {
      const r = await fetch(`/api/models/${modelId}/versions`, { method: "POST", body: fd });
      const body = (await r.json().catch(() => ({}))) as { error?: string; number?: number };
      if (r.ok && typeof body.number === "number") {
        setResult({ ok: true, message: t.uploaded(body.number) });
        form.current?.reset();
        router.refresh();
      } else setResult({ ok: false, error: body.error ?? t.failed });
    } catch {
      setResult({ ok: false, error: t.failed });
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className={ui.h2}>
        {t.upload}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.uploadHint}</p>
      <form ref={form} onSubmit={submit} className="mt-3 space-y-3">
        <label className="block">
          <span className={ui.label}>{t.file}</span>
          <input type="file" name="model" accept=".3mf" required className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>{t.preview}</span>
          <input type="file" name="preview" accept=".png,image/png" required className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>{t.drawingFiles}</span>
          <input type="file" name="drawing" accept=".png,.svg,.pdf" multiple className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>{t.note}</span>
          <textarea name="note" rows={2} className={ui.input} />
        </label>
        <button type="submit" disabled={sending} className={ui.button}>
          {sending ? t.sending : t.send}
        </button>
        <Notice result={result} />
      </form>
    </section>
  );
}
