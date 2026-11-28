"use client";
import { useActionState, useState } from "react";
import { useCopy } from "@/components/CopyProvider";
import { Dialog } from "@/components/Dialog";
import { EditIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { saveCustomer } from "../../actions";
import { CustomerFields } from "../../NewCustomer";

// The pencil by the customer's name: their name, note and the language their page opens in, in a dialog that closes once saved.
export function EditCustomer({ customer }: { customer: { id: string; name: string; note: string; language: string } }) {
  const t = useCopy();
  const c = t.admin.customer;
  const [open, setOpen] = useState(false);
  const [result, submit, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveCustomer>> | null, fd: FormData) => {
    const r = await saveCustomer(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, null);
  return (
    <>
      <button type="button" aria-label={c.edit} title={c.edit} onClick={() => setOpen(true)} className={`${ui.icon} size-9 shrink-0`}>
        <EditIcon aria-hidden="true" className={ui.iconSize} />
      </button>
      <Dialog open={open} title={c.edit} onClose={() => setOpen(false)}>
        <form action={submit} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={customer.id} />
          <CustomerFields name={customer.name} note={customer.note} language={customer.language} />
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={ui.secondary}>
              {t.common.cancel}
            </button>
            <button type="submit" disabled={pending} className={ui.button}>
              {c.save}
            </button>
          </div>
          {result && !result.ok && <Notice result={result} />}
        </form>
      </Dialog>
    </>
  );
}
