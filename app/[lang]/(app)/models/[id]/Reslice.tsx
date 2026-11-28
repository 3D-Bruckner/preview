"use client";
import { useActionState } from "react";
import { useCopy } from "@/components/CopyProvider";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { useHydrated } from "@/components/useHydrated";
import { reslice } from "../../actions";

// "Neu berechnen" under a version whose slicing failed: the slicer is asked again (reslice_version).
export function Reslice({ versionId }: { versionId: string }) {
  const t = useCopy().admin.model.figures;
  const hydrated = useHydrated();
  const [result, submit, pending] = useActionState(reslice, null);
  return (
    <form action={submit} className="mt-2 flex flex-wrap items-center gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <button type="submit" disabled={!hydrated || pending} className={ui.secondary}>
        {pending ? t.reslicing : t.reslice}
      </button>
      <Notice result={result} />
    </form>
  );
}
