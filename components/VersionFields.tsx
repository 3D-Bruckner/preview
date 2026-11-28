"use client";
import { useCopy } from "@/components/CopyProvider";
import { UploadIcon } from "@/components/icons";
import { ui } from "@/components/ui";

/** The file fields of a version upload: the 3MF (a drop area), the optional own picture, and with `drawings` the drawings and the note. */
export function VersionFields({ drawings = true, onModel }: { drawings?: boolean; onModel?: (file: File | null) => void }) {
  const t = useCopy().admin;
  return (
    <>
      <label className="block cursor-pointer rounded-md border-2 border-dashed border-line bg-surface p-4 text-center hover:border-accent focus-within:border-accent">
        <UploadIcon aria-hidden="true" className="mx-auto size-6 text-muted" />
        <span className="mt-1 block font-semibold">{t.customer.firstFile}</span>
        <input
          type="file"
          name="model"
          accept=".3mf"
          required
          onChange={(e) => onModel?.(e.currentTarget.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-ink"
        />
      </label>
      <label className="block">
        <span className={ui.label}>{t.model.preview}</span>
        <input type="file" name="preview" accept=".png,image/png" className={`${ui.input} text-sm`} />
        <span className={ui.hint}>{t.model.previewHint}</span>
      </label>
      {drawings && (
        <>
          <label className="block">
            <span className={ui.label}>{t.model.drawingFiles}</span>
            <input type="file" name="drawing" accept=".png,.svg,.pdf" multiple className={`${ui.input} text-sm`} />
          </label>
          <label className="block">
            <span className={ui.label}>{t.model.note}</span>
            <textarea name="note" rows={2} className={ui.input} />
          </label>
        </>
      )}
    </>
  );
}

/** The upload's body without empty file inputs (a browser sends a nameless empty file for each). */
export function uploadBody(form: HTMLFormElement): FormData {
  const fd = new FormData(form);
  const out = new FormData();
  for (const [k, v] of fd.entries()) {
    if (!["model", "preview", "drawing", "note"].includes(k)) continue;
    if (v instanceof File && v.size === 0) continue;
    out.append(k, v);
  }
  return out;
}

/** Posts a version; the new version's number, or the refusal's words. */
export async function postVersion(modelId: string, body: FormData, failed: string): Promise<{ ok: true; number: number } | { ok: false; error: string }> {
  try {
    const r = await fetch(`/api/models/${modelId}/versions`, { method: "POST", body });
    const json = (await r.json().catch(() => ({}))) as { error?: string; number?: number };
    return r.ok && typeof json.number === "number" ? { ok: true, number: json.number } : { ok: false, error: json.error ?? failed };
  } catch {
    return { ok: false, error: failed };
  }
}
