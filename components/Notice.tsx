import { ProblemIcon, SavedIcon } from "@/components/icons";
import { ui } from "@/components/ui";

// What an action answered: a problem as an alert, a success as a status, both with a word and an icon, not colour alone. The status
// region is always there, so a screen reader hears the change.
export function Notice({ result }: { result: { ok: true; message?: string } | { ok: false; error: string } | null }) {
  if (result && !result.ok)
    return (
      <p role="alert" className={ui.problem}>
        <ProblemIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {result.error}
      </p>
    );
  return (
    <p role="status" className={ui.status}>
      {result?.message && (
        <>
          <SavedIcon aria-hidden="true" className={ui.iconSize} />
          {result.message}
        </>
      )}
    </p>
  );
}
