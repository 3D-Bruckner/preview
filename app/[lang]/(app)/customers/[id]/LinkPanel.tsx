"use client";
import { useId, useState, useTransition } from "react";
import { useCopy } from "@/components/CopyProvider";
import { ConfirmDialog } from "@/components/Dialog";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { renewCustomerLink, revokeCustomerLink, type Result } from "../../actions";

type Confirming = "renew" | "revoke" | null;

// The customer's link: shown in full (it is stored in clear so it can be copied at any time), with a copy button that says it copied,
// and renew and revoke, each asking first and saying that the old link stops working.
export function LinkPanel({ customerId, url }: { customerId: string; url: string | null }) {
  const t = useCopy();
  const c = t.admin.customer;
  const headingId = useId();
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!);
      setResult({ ok: true, message: c.copied });
    } catch {
      setResult({ ok: false, error: c.copyFailed });
    }
  }

  const run = (action: (id: string) => Promise<Result>) => {
    setConfirming(null);
    start(async () => setResult(await action(customerId)));
  };

  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h2 id={headingId} className={ui.h2}>
        {c.link}
      </h2>
      {url ? (
        <>
          <p className="mt-1 text-sm text-muted">{c.linkHint}</p>
          <input readOnly aria-labelledby={headingId} value={url} onFocus={(e) => e.currentTarget.select()} className={`${ui.input} font-mono text-sm`} />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={copy} className={ui.button}>
              {c.copy}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming("renew")} className={ui.secondary}>
              {c.renew}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming("revoke")} className={ui.danger}>
              {c.revoke}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-muted">{c.noLink}</p>
          <button type="button" disabled={busy} onClick={() => run(renewCustomerLink)} className={`${ui.button} mt-3`}>
            {c.create}
          </button>
        </>
      )}
      <div className="mt-2">
        <Notice result={result} />
      </div>
      <ConfirmDialog
        open={confirming === "renew"}
        title={c.renewTitle}
        text={<p>{c.renewConfirm}</p>}
        confirm={c.renew}
        cancel={t.common.cancel}
        busy={busy}
        onClose={() => setConfirming(null)}
        onConfirm={() => run(renewCustomerLink)}
      />
      <ConfirmDialog
        open={confirming === "revoke"}
        title={c.revokeTitle}
        text={<p>{c.revokeConfirm}</p>}
        confirm={c.revoke}
        cancel={t.common.cancel}
        busy={busy}
        onClose={() => setConfirming(null)}
        onConfirm={() => run(revokeCustomerLink)}
      />
    </section>
  );
}
