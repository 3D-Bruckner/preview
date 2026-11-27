"use client";
// A modal dialog on the browser's own <dialog>: focus moves into it and stays there, Escape closes it, and focus returns to what opened
// it. Named by its heading.
import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`m-auto w-[calc(100%-2rem)] rounded-xl border border-border bg-paper p-5 text-ink ${wide ? "max-w-2xl" : "max-w-md"}`}
    >
      {open && (
        <>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}

/** A question with Cancel and a destructive confirm. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirm,
  cancel,
  onConfirm,
  onClose,
  busy = false,
}: {
  open: boolean;
  title: string;
  text: ReactNode;
  confirm: string;
  cancel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <div className="mt-3 space-y-2">{text}</div>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" autoFocus onClick={onClose} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-medium">
          {cancel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="inline-flex min-h-11 items-center rounded-lg bg-danger px-4 font-medium text-paper disabled:opacity-50"
        >
          {confirm}
        </button>
      </div>
    </Dialog>
  );
}
