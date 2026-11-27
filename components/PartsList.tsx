"use client";
import { useMemo } from "react";
import type { Facts } from "@/backend/client";
import { Card } from "@/components/Card";
import { useCopy } from "@/components/CopyProvider";
import { FocusIcon, HiddenIcon, ShownIcon } from "@/components/icons";
import { GREY_HEX } from "@/components/viewer/colours";

/** Each part's name as the list shows it: its own, or "Teil i"; a name several parts share is numbered (Spule 1, Spule 2). */
export function usePartLabels(facts: Facts): ReadonlyMap<string, string> {
  const t = useCopy().customer.parts;
  return useMemo(() => {
    const names = facts.parts.map((p, i) => p.name ?? t.unnamed(i + 1));
    const total = new Map<string, number>();
    for (const n of names) total.set(n, (total.get(n) ?? 0) + 1);
    const seen = new Map<string, number>();
    return new Map(
      facts.parts.map((p, i) => {
        const n = names[i]!;
        if (total.get(n)! < 2) return [p.key, n];
        const k = (seen.get(n) ?? 0) + 1;
        seen.set(n, k);
        return [p.key, t.numbered(n, k)];
      }),
    );
  }, [facts, t]);
}

type Props = {
  facts: Facts;
  labels: ReadonlyMap<string, string>;
  focused: string | null;
  hidden: ReadonlySet<string>;
  onFocus: (key: string) => void;
  onToggle: (key: string) => void;
  onHover: (key: string | null) => void;
};

const toggle = "inline-flex size-[30px] shrink-0 items-center justify-center rounded-[4px] text-muted hover:bg-surface hover:text-ink aria-pressed:text-ink";

/** The Teile card: per part its filament's swatch, name and filament, a button that shows it alone and an eye that hides it. */
export function PartsList({ facts, labels, focused, hidden, onFocus, onToggle, onHover }: Props) {
  const t = useCopy().customer;
  return (
    <Card id="parts" title={t.parts.title} aside={facts.parts.length}>
      <ul className="divide-y divide-border">
        {facts.parts.map((p) => {
          const slot = p.slot ? facts.slots[p.slot - 1] : undefined;
          const filament = [slot?.type, slot?.color].filter(Boolean).join(" · ") || t.parts.unknownFilament;
          const name = labels.get(p.key)!;
          const off = hidden.has(p.key);
          return (
            <li
              key={p.key}
              onMouseEnter={() => onHover(p.key)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(p.key)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHover(null);
              }}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span
                aria-hidden="true"
                className={`size-[18px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.45)] ${off ? "opacity-45" : ""}`}
                style={{ background: slot?.color ?? GREY_HEX }}
              />
              <span className={`min-w-0 flex-1 ${off ? "opacity-45" : ""}`}>
                <span className="block truncate text-sm font-semibold">{name}</span>
                <span className="block truncate text-[0.8125rem] text-muted">{filament}</span>
              </span>
              <button type="button" aria-pressed={focused === p.key} aria-label={t.parts.focus(name)} onClick={() => onFocus(p.key)} className={toggle}>
                <FocusIcon aria-hidden="true" className="size-4" />
              </button>
              <button type="button" aria-pressed={!off} aria-label={t.parts.toggle(name)} onClick={() => onToggle(p.key)} className={toggle}>
                {off ? <HiddenIcon aria-hidden="true" className="size-4" /> : <ShownIcon aria-hidden="true" className="size-4" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
