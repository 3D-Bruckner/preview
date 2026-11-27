"use client";
// The ways in that signInMethods offers: a code by mail (the mail also holds a link, except during an MCP client's sign-in, so the page
// speaks of the code only) and a button per provider. Each lands on `next`; during an MCP client's or a script's sign-in,
// Better Auth's answer names where to go instead (the consent page), and the auth client carries the signed query along.
import { useState, type FormEvent } from "react";
import { authClient } from "@/app/_lib/auth-client";
import { useCopy } from "@/components/CopyProvider";

type Methods = { email: boolean; providers: { id: string; label: string }[] };

const button = "w-full rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50";
const secondary = "w-full rounded border border-neutral-300 px-4 py-2 font-medium disabled:opacity-50";
const field = "mt-1 w-full rounded border border-neutral-300 px-3 py-2";

/** Where to go after a sign-in: the URL Better Auth's answer names (an OAuth sign-in's next step), else `next`. */
function go(data: unknown, next: string) {
  const url = data && typeof data === "object" && "url" in data && typeof data.url === "string" ? data.url : next;
  window.location.assign(url);
}

/**
 * `signInPage` is where a provider's refusal comes back to: openAuth's pages.signIn, handed down by the page (backend's SIGN_IN_PAGE).
 * `mailNotSent` is the error code the kit answers a code with that its mail server would not take (the kit's MAIL_NOT_SENT, handed down
 * because the kit's sign-in module is for the server).
 */
export function SignInForm({ next, methods, signInPage, mailNotSent }: { next: string; methods: Methods; signInPage: string; mailNotSent: string }) {
  const t = useCopy().signIn;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setBusy(false);
    if (error) return setProblem(error.code === mailNotSent ? t.mailNotSent : t.failedSend);
    setSentTo(email.trim());
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const { data, error } = await authClient.signIn.emailOtp({ email: sentTo ?? "", otp: code.trim() });
    if (error) {
      setBusy(false);
      return setProblem(t.wrongCode);
    }
    go(data, next);
  }

  async function provider(id: string, label: string) {
    setBusy(true);
    setProblem(null);
    // On success the browser is on its way to the provider; an error (the provider's start refused, the network) stays on this page.
    const { error } = await authClient.signIn.social({
      provider: id,
      callbackURL: next,
      errorCallbackURL: `${signInPage}?${new URLSearchParams({ provider: id, next })}`,
    });
    if (error) {
      setBusy(false);
      setProblem(t.providerFailed(label));
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {problem && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">
          {problem}
        </p>
      )}
      {methods.email && !sentTo && (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">{t.email}</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </label>
          <button type="submit" disabled={busy} className={button}>
            {busy ? t.sending : t.sendCode}
          </button>
        </form>
      )}
      {methods.email && sentTo && (
        <form onSubmit={checkCode} className="space-y-3">
          <p role="status">{t.sent(sentTo)}</p>
          <label className="block">
            <span className="text-sm font-medium">{t.code}</span>
            <input
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={field}
            />
          </label>
          <button type="submit" disabled={busy} className={button}>
            {t.checkCode}
          </button>
          <button type="button" onClick={() => (setSentTo(null), setCode(""))} className="text-sm underline">
            {t.otherAddress}
          </button>
        </form>
      )}
      {methods.providers.length > 0 && (
        <div className="space-y-3">
          {methods.email && <p className="text-center text-sm text-neutral-500">{t.or}</p>}
          {methods.providers.map((p) => (
            <button key={p.id} type="button" disabled={busy} onClick={() => provider(p.id, p.label)} className={secondary}>
              {t.viaProvider(p.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
