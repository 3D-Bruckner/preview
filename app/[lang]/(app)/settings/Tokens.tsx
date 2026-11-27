"use client";
import { startTransition, useActionState, useId, useState, useTransition, type FormEvent } from "react";
import { useCopy } from "@/components/CopyProvider";
import { ConfirmDialog } from "@/components/Dialog";
import { AddIcon, DeleteIcon, TokenIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { addToken, revokeToken, type Result } from "../actions";

type Token = { id: string; name: string; scope: "read" | "read+write"; lastUsed: string | null; expires: string | null };

export function Tokens({ tokens }: { tokens: Token[] }) {
  const t = useCopy();
  const tt = t.settings.tokens;
  const headingId = useId();
  const [made, create, creating] = useActionState(addToken, null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, start] = useTransition();
  const [revoking, setRevoking] = useState<Token | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    startTransition(() => create(fd));
  }

  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h2 id={headingId} className={`${ui.h2} flex items-center gap-2`}>
        <TokenIcon aria-hidden="true" className={ui.iconSize} />
        {tt.heading}
      </h2>
      <p className="mt-1 text-sm text-muted">{tt.intro}</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block">
          <span className={ui.label}>{tt.name}</span>
          <input name="name" required maxLength={60} className={ui.input} />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="block">
            <span className={ui.label}>{tt.scope}</span>
            <select name="scope" defaultValue="read" className={ui.input}>
              <option value="read">{tt.scopes.read}</option>
              <option value="read+write">{tt.scopes["read+write"]}</option>
            </select>
          </label>
          <label className="block">
            <span className={ui.label}>{tt.expiry}</span>
            <select name="expiry" defaultValue="90" className={ui.input}>
              {(["30", "90", "365", "never"] as const).map((e) => (
                <option key={e} value={e}>
                  {tt.expiries[e]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={creating} className={ui.button}>
          <AddIcon aria-hidden="true" className={ui.iconSize} />
          {tt.create}
        </button>
      </form>
      {made?.ok && made.token ? (
        <div className="mt-4 rounded-lg border-2 border-accent p-3">
          <label className="block">
            <span className={ui.label}>{tt.created}</span>
            <input readOnly value={made.token} onFocus={(e) => e.currentTarget.select()} className={`${ui.input} font-mono text-sm`} />
          </label>
          <p className={ui.hint}>{tt.copyHint}</p>
        </div>
      ) : (
        <div className="mt-2">
          <Notice result={made} />
        </div>
      )}
      <h3 className="mt-6 font-semibold">{tt.list}</h3>
      <div className="mt-2">
        <Notice result={result} />
      </div>
      {tokens.length === 0 ? (
        <p className="mt-2 text-muted">{tt.none}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {tokens.map((k) => (
            <li key={k.id} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{k.name}</span>
                <span className="block text-sm text-muted">{tt.scopes[k.scope]}</span>
                <span className="block text-sm text-muted">{tt.lastUsed(k.lastUsed)}</span>
                <span className="block text-sm text-muted">{tt.expires(k.expires)}</span>
              </span>
              <button type="button" aria-label={tt.revoke(k.name)} disabled={busy} onClick={() => setRevoking(k)} className={ui.danger}>
                <DeleteIcon aria-hidden="true" className={ui.iconSize} />
                <span className="sr-only sm:not-sr-only">{tt.revokeShort}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={revoking !== null}
        title={revoking ? tt.revoke(revoking.name) : ""}
        text={<p>{revoking ? tt.revokeConfirm(revoking.name) : ""}</p>}
        confirm={tt.revokeShort}
        cancel={t.common.cancel}
        busy={busy}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          const id = revoking!.id;
          setRevoking(null);
          start(async () => setResult(await revokeToken(id)));
        }}
      />
    </section>
  );
}
