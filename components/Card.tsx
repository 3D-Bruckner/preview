import type { ReactNode } from "react";

/** A card of a model page's side panel: a small heading row over a hairline, an optional muted note on the right. */
export function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-md border border-border bg-paper">
      <h2 id={id} className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3 text-sm font-semibold">
        {title}
        {aside != null && <span className="min-w-0 truncate text-[0.8125rem] font-normal text-muted tabular">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}
