"use client";
// Ends this browser's session and goes to the sign-in page; the refresh drops what the router kept of the signed-in pages.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/app/_lib/auth-client";
import { useCopy } from "@/components/CopyProvider";
import { SignOutIcon } from "@/components/icons";
import { Notice } from "@/components/Notice";
import { useHydrated } from "@/components/useHydrated";
import { ui } from "@/components/ui";

export function SignOut() {
  const t = useCopy();
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <section className="mt-10 border-t border-border pt-5">
      <button
        type="button"
        disabled={busy || !hydrated}
        className={`${ui.secondary} w-full justify-center`}
        onClick={() => {
          setFailed(false);
          start(async () => {
            const { error } = await authClient.signOut();
            if (error) return setFailed(true);
            router.replace("/signin");
            router.refresh();
          });
        }}
      >
        <SignOutIcon aria-hidden="true" className={ui.iconSize} />
        {t.settings.signOut}
      </button>
      {failed && <Notice result={{ ok: false, error: t.common.failed }} />}
    </section>
  );
}
