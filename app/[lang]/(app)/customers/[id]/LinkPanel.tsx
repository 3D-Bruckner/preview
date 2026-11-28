"use client";
import { useState, useTransition } from "react";
import { useCopy } from "@/components/CopyProvider";
import { ConfirmDialog } from "@/components/Dialog";
import { ChatIcon, CopyIcon, MailIcon, OpenLinkIcon, RenewIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { renewCustomerLink, revokeCustomerLink, type Result } from "../../actions";

type Confirming = "renew" | "revoke" | null;

const small = "min-h-10 px-3 text-sm";

/**
 * The customer's link box: the link in full (stored in clear so it can be copied at any time), Link kopieren (says it copied), Öffnen (a new
 * tab; the operator is signed in there, so the look is not counted as the customer's), Neuer Link and, smaller, Link sperren, each asking
 * first. Under it the ways Marcel sends it himself: WhatsApp and mail, with a prepared text in the customer's language (`share`), and when
 * the customer last opened it (`seen`).
 */
export function LinkPanel({
  customerId,
  name,
  url,
  share,
  seen,
}: {
  customerId: string;
  name: string;
  url: string | null;
  share: { subject: string; text: string } | null;
  seen: string;
}) {
  const t = useCopy();
  const c = t.admin.customer;
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
    <section aria-labelledby="link" className="border-t border-border px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="link" className="text-sm font-semibold">
          {c.link}
        </h2>
        {url && (
          <button type="button" disabled={busy} onClick={() => setConfirming("revoke")} className="text-sm text-danger underline underline-offset-3">
            {c.revoke}
          </button>
        )}
      </div>
      {url ? (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <input
              readOnly
              aria-labelledby="link"
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="col-span-full min-h-10 w-full min-w-0 rounded-md border border-line bg-surface px-3 font-mono text-sm text-ink sm:col-span-1"
            />
            <button type="button" onClick={copy} className={`${ui.button} ${small} col-span-full sm:col-span-1`}>
              <CopyIcon aria-hidden="true" className={ui.iconSize} />
              {c.copy}
            </button>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <a href={url} target="_blank" rel="noreferrer" title={c.openHint} className={`${ui.secondary} ${small}`}>
                <OpenLinkIcon aria-hidden="true" className={ui.iconSize} />
                {c.open}
              </a>
              <button type="button" disabled={busy} onClick={() => setConfirming("renew")} className={`${ui.secondary} ${small}`}>
                <RenewIcon aria-hidden="true" className={ui.iconSize} />
                {c.renewShort}
              </button>
            </div>
          </div>
          {share && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{c.sendTo(name)}</span>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(share.text)}`}
                target="_blank"
                rel="noreferrer"
                className={`${ui.secondary} min-h-9 px-3 text-sm`}
              >
                <ChatIcon aria-hidden="true" className={ui.iconSize} />
                {c.whatsApp}
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent(share.subject)}&body=${encodeURIComponent(share.text)}`}
                className={`${ui.secondary} min-h-9 px-3 text-sm`}
              >
                <MailIcon aria-hidden="true" className={ui.iconSize} />
                {c.mail}
              </a>
              <q className="basis-full text-muted italic">{share.text}</q>
            </div>
          )}
          <p className="mt-3 text-sm text-muted">
            {c.linkHint} {seen}
          </p>
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
