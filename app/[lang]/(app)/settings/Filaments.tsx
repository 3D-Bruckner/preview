"use client";
import { useActionState, useId, useState, useTransition } from "react";
import { useCopy } from "@/components/CopyProvider";
import { ConfirmDialog } from "@/components/Dialog";
import { AddIcon, DeleteIcon, FilamentsIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { addFilament, removeFilament, saveFilament, type Result } from "../actions";

export type FilamentItem = { id: string; name: string; material: string; color: string; available: boolean; position: number };

// The operator's filaments: what customers can pick per part (backend/filaments.ts). Added at the end; each one edited in place (name,
// material, colour, whether it is offered, its position) or deleted.
export function Filaments({ filaments }: { filaments: FilamentItem[] }) {
  const t = useCopy().settings.filaments;
  const cancel = useCopy().common.cancel;
  const headingId = useId();
  const [added, add, adding] = useActionState(addFilament, null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, start] = useTransition();
  const [removing, setRemoving] = useState<FilamentItem | null>(null);
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className={`${ui.h2} flex items-center gap-2`}>
        <FilamentsIcon aria-hidden="true" className={ui.iconSize} />
        {t.heading}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.intro}</p>
      <form action={add} className="mt-4 space-y-3">
        <FilamentFields />
        <button type="submit" disabled={adding} className={ui.button}>
          <AddIcon aria-hidden="true" className={ui.iconSize} />
          {t.add}
        </button>
        <Notice result={added} />
      </form>
      <div className="mt-4">
        <Notice result={result} />
      </div>
      {filaments.length === 0 ? (
        <p className="mt-2 text-muted">{t.none}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {filaments.map((f) => (
            <li key={f.id} className="p-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.45)]"
                  style={{ background: f.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block text-sm text-muted tabular">
                    {f.material} · {f.color}
                    {!f.available && <span className="ml-2 rounded-full border border-line px-2 text-xs">{t.notOffered}</span>}
                  </span>
                </span>
                <button type="button" aria-label={t.remove(f.name)} disabled={busy} onClick={() => setRemoving(f)} className={ui.danger}>
                  <DeleteIcon aria-hidden="true" className={ui.iconSize} />
                  <span className="sr-only sm:not-sr-only">{t.removeShort}</span>
                </button>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-accent underline">{t.edit}</summary>
                <EditFilament filament={f} />
              </details>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={removing !== null}
        title={removing ? t.remove(removing.name) : ""}
        text={<p>{removing ? t.removeConfirm(removing.name) : ""}</p>}
        confirm={t.removeShort}
        cancel={cancel}
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const id = removing!.id;
          setRemoving(null);
          start(async () => setResult(await removeFilament(id)));
        }}
      />
    </section>
  );
}

function EditFilament({ filament }: { filament: FilamentItem }) {
  const t = useCopy().settings.filaments;
  const [saved, save, saving] = useActionState(saveFilament, null);
  return (
    <form action={save} className="mt-3 space-y-3">
      <input type="hidden" name="id" value={filament.id} />
      <FilamentFields filament={filament} />
      <button type="submit" disabled={saving} className={ui.secondary}>
        {t.save}
      </button>
      <Notice result={saved} />
    </form>
  );
}

/** Name, material, colour and "offered"; with a filament, its values and its position too. */
function FilamentFields({ filament }: { filament?: FilamentItem }) {
  const t = useCopy().settings.filaments;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className="block min-w-48 flex-1">
          <span className={ui.label}>{t.name}</span>
          <input name="name" required maxLength={60} defaultValue={filament?.name} className={ui.input} />
        </label>
        <label className="block w-32">
          <span className={ui.label}>{t.material}</span>
          <input name="material" required maxLength={20} defaultValue={filament?.material ?? "PLA"} className={ui.input} />
        </label>
        <label className="block">
          <span className={ui.label}>{t.color}</span>
          <input name="color" type="color" defaultValue={filament?.color ?? "#000000"} className={`${ui.input} h-10.5 w-16 p-1`} />
        </label>
        {filament && (
          <label className="block w-24">
            <span className={ui.label}>{t.position}</span>
            <input name="position" type="number" min={1} step={1} defaultValue={filament.position} className={ui.input} />
          </label>
        )}
      </div>
      <span className={ui.hint}>{t.materialHint}</span>
      <label className="flex items-center gap-2 text-sm">
        <input name="available" type="checkbox" defaultChecked={filament?.available ?? true} className="size-4" />
        {t.available}
      </label>
    </>
  );
}
