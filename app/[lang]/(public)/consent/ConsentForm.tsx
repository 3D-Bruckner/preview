"use client";
// Allow or deny the client (next-app-kit's examples/minimal). oauthProviderClient sends this page's signed query along, which says what is
// consented to.
import { useState } from "react";
import { authClient } from "@/app/_lib/auth-client";
import { useCopy } from "@/components/CopyProvider";

export function ConsentForm() {
  const t = useCopy().consent;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function answer(accept: boolean) {
    setBusy(true);
    const { data, error } = await authClient.oauth2.consent({ accept });
    if (error || !data?.url) {
      setBusy(false);
      setFailed(true);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(true)}
          className="rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {t.allow}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(false)}
          className="rounded border border-neutral-300 px-4 py-2 font-medium disabled:opacity-50"
        >
          {t.deny}
        </button>
      </div>
      {failed && <p role="alert">{t.failed}</p>}
    </div>
  );
}
