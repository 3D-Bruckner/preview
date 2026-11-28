"use client";
import { useMemo } from "react";
import type { Facts } from "@/backend/client";
import { Card } from "@/components/Card";
import { useCopy } from "@/components/CopyProvider";
import { FocusIcon, RemoveIcon } from "@/components/icons";
import { GREY_HEX } from "@/components/viewer/colours";
import { useWishes } from "@/components/Wishes";

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
  /** The parts shown alone; none: the whole model. */
  focused: ReadonlySet<string>;
  /** Adds the part to what is shown alone, or takes it out. */
  onFocus: (key: string) => void;
  onHover: (key: string | null) => void;
};

const toggle = "inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] text-muted hover:bg-surface hover:text-ink aria-pressed:text-accent";

/**
 * The Teile & Farben card: per part its filament's swatch, name and filament, with the operator's filaments on offer a picker of them
 * ("wie im Entwurf": the file's own), whose pick the swatch and the view show, and a button that adds the part to what is shown alone
 * (× takes it out again). The parts shown alone are tinted and barred, the others dimmed: not colour alone, the button says which. The
 * list scrolls on a desktop after about six rows, so the Rückmeldung under it stays in sight.
 */
export function PartsList({ facts, labels, focused, onFocus, onHover }: Props) {
  const t = useCopy().customer;
  const wishes = useWishes();
  const colourOf = new Map(wishes.filaments.map((f) => [f.id, f.color]));
  const total = facts.parts.length;
  return (
    <Card
      id="parts"
      title={wishes.filaments.length > 0 ? t.parts.titleColours : t.parts.title}
      aside={focused.size > 0 ? t.parts.shownOf(focused.size, total) : total}
    >
      {total > 1 && (
        <p className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2 text-[0.8125rem] text-muted">
          {t.parts.hintBefore}
          <FocusIcon aria-hidden="true" className="size-3.5" />
          {t.parts.hintAfter}
        </p>
      )}
      <ul className="divide-y divide-border lg:max-h-[300px] lg:overflow-y-auto lg:overscroll-contain">
        {facts.parts.map((p) => {
          const slot = p.slot ? facts.slots[p.slot - 1] : undefined;
          const filament = [slot?.type, slot?.color].filter(Boolean).join(" · ") || t.parts.unknownFilament;
          const name = labels.get(p.key)!;
          const on = focused.has(p.key);
          const dimmed = focused.size > 0 && !on;
          const pick = wishes.picked.get(p.key) ?? "";
          return (
            <li
              key={p.key}
              data-focused={on || undefined}
              onMouseEnter={() => onHover(p.key)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(p.key)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHover(null);
              }}
              className={`relative flex items-center gap-3 px-4 py-2.5 ${on ? "bg-[color-mix(in_oklab,var(--accent)_9%,var(--bg))] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`size-[18px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.45)] ${dimmed ? "opacity-45" : ""}`}
                style={{ background: colourOf.get(pick) ?? slot?.color ?? GREY_HEX }}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${on ? "font-bold" : "font-semibold"} ${dimmed ? "font-medium text-muted" : ""}`}>{name}</span>
                <span className="block truncate text-[0.8125rem] text-muted">{filament}</span>
              </span>
              {wishes.filaments.length > 0 && (
                <select
                  aria-label={t.parts.colour(name)}
                  value={pick}
                  onChange={(e) => wishes.pick(p.key, e.target.value || null)}
                  className="h-8 w-[8.5rem] shrink-0 truncate rounded-[4px] border border-line bg-paper px-1.5 text-[0.8125rem] text-ink"
                >
                  <option value="">{t.parts.asDrafted}</option>
                  {wishes.filaments.map((f) => (
                    <option key={f.id} value={f.id}>
                      {t.parts.option(f.name, f.material)}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                aria-pressed={on}
                aria-label={on ? t.parts.remove(name) : t.parts.add(name)}
                title={on ? t.parts.remove(name) : t.parts.add(name)}
                onClick={() => onFocus(p.key)}
                className={toggle}
              >
                {on ? <RemoveIcon aria-hidden="true" className="size-4" /> : <FocusIcon aria-hidden="true" className="size-4" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
