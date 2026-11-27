"use client";
import { Card } from "@/components/Card";
import { useCopy, useLocale } from "@/components/CopyProvider";
import { formatMm } from "@/components/format";
import type { Size } from "@/components/viewer/scene";

/** The Maße card: width, depth and height of what the view shows; `scope` names the focused part (null: the whole model). */
export function Dimensions({ size, scope }: { size: Size | null; scope: string | null }) {
  const t = useCopy().customer.dims;
  const lang = useLocale();
  const rows = [
    [t.width, size?.x],
    [t.depth, size?.y],
    [t.height, size?.z],
  ] as const;
  return (
    <Card id="dims" title={t.title} aside={scope ?? t.whole}>
      <dl className="grid grid-cols-3 tabular">
        {rows.map(([label, mm]) => (
          <div key={label} className="border-l border-border px-4 py-3 first:border-l-0">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tracking-tight">
              {mm === undefined ? "–" : formatMm(mm, lang)} <small className="text-xs font-normal text-muted">{t.mm}</small>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
