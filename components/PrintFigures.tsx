import { Card } from "@/components/Card";
import { copyFor } from "@/components/copy";
import { formatGrams, hoursMinutes } from "@/components/format";
import { RefreshWhilePending } from "@/components/RefreshWhilePending";
import { GREY_HEX } from "@/components/viewer/colours";
import type { NamedFigures } from "@/backend/client";

/**
 * The Druck card of a model page's side panel: print time and weight of the whole model, and each filament's grams, named as the
 * operator's list names it when one matches its colour and material exactly. While the slicer
 * works it out, a line that says so (and the page looks again by itself); without figures and nothing pending, no card.
 */
export function PrintFigures({ lang, figures, pending }: { lang: string; figures: NamedFigures | null; pending: boolean }) {
  const t = copyFor(lang).customer.print;
  if (!figures && !pending) return null;
  if (!figures)
    return (
      <Card id="print" title={t.title} aside={t.pending}>
        <p role="status" className="px-4 py-3 text-sm text-muted">
          {t.pendingHint}
        </p>
        <RefreshWhilePending />
      </Card>
    );
  const { h, m } = hoursMinutes(figures.seconds);
  return (
    <Card id="print" title={t.title} aside={t.whole}>
      <dl className="grid grid-cols-2 tabular">
        {(
          [
            [t.time, t.duration(h, m)],
            [t.weight, `${formatGrams(figures.grams, lang)} ${t.g}`],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="border-l border-border px-4 py-3 first:border-l-0">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      {figures.filaments.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {figures.filaments.map((f) => (
            <li key={f.slot} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span
                aria-hidden="true"
                className="size-[18px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.45)]"
                style={{ background: f.color ?? GREY_HEX }}
              />
              <span className="min-w-0 flex-1 truncate">{f.name ?? ([f.type, f.color].filter(Boolean).join(" · ") || t.unknownFilament)}</span>
              <span className="tabular text-muted">
                {formatGrams(f.grams, lang)} {t.g}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
