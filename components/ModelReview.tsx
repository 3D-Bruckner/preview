"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { CustomerFilament, Facts } from "@/backend/client";
import { useCopy } from "@/components/CopyProvider";
import { Dimensions } from "@/components/Dimensions";
import { ModelViewer } from "@/components/ModelViewer";
import { PartsList, usePartLabels } from "@/components/PartsList";
import type { Size } from "@/components/viewer/scene";
import { WishesProvider } from "@/components/Wishes";

const NONE: ReadonlySet<string> = new Set();

/**
 * A model page's review: the 3D view large, with Maße and Druck side by side under it and then `below` (the drawings); beside it, from
 * 1024 px, a side panel that stays in sight: Teile & Farben, then `children` (the Rückmeldung card). Below 1024 px it all stacks. The one
 * place that holds what the visitor picked: the parts shown alone (several at once), the one under the pointer, the shown size, and a
 * filament per part (the view shows it; `children` read it through useWishes, the Rückmeldung card to send it).
 */
export function ModelReview({
  src,
  label,
  facts,
  print,
  below,
  filaments = [],
  children,
}: {
  src: string;
  label: string;
  facts: Facts;
  /** The Druck card (PrintFigures), beside Maße. */
  print?: ReactNode;
  /** Under Maße and Druck: the drawings. */
  below?: ReactNode;
  /** The operator's filaments on offer: a picker per part when there are any. */
  filaments?: readonly CustomerFilament[];
  children: ReactNode;
}) {
  const t = useCopy().customer;
  const [focused, setFocused] = useState<ReadonlySet<string>>(NONE);
  const [hovered, setHovered] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [picked, setPicked] = useState<ReadonlyMap<string, string>>(new Map());
  const labels = usePartLabels(facts);
  const colours = useMemo(() => {
    const byId = new Map(filaments.map((f) => [f.id, f.color]));
    return new Map([...picked].flatMap(([part, id]) => (byId.has(id) ? [[part, byId.get(id)!] as const] : [])));
  }, [picked, filaments]);
  const wishes = useMemo(
    () => ({
      filaments,
      picked,
      labels,
      pick: (part: string, id: string | null) =>
        setPicked((p) => {
          const next = new Map(p);
          if (id) next.set(part, id);
          else next.delete(part);
          return next;
        }),
    }),
    [filaments, picked, labels],
  );
  // What is shown alone, in the list's order: "Box + Deckel", or "4 Teile" past three.
  const shown = facts.parts.filter((p) => focused.has(p.key)).map((p) => labels.get(p.key) ?? p.key);
  const scope = shown.length === 0 ? null : shown.length <= 3 ? shown.join(" + ") : t.focusBar.several(shown.length);
  return (
    <WishesProvider value={wishes}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <ModelViewer
            key={src}
            src={src}
            label={label}
            facts={facts}
            focused={focused}
            hovered={hovered}
            colours={colours}
            size={size}
            onSize={setSize}
            focusLabel={scope}
            onWhole={() => setFocused(NONE)}
          />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Dimensions size={size} scope={scope} />
            {print}
          </div>
          {below}
        </div>
        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-4">
          {facts.parts.length > 0 && (
            <PartsList
              facts={facts}
              labels={labels}
              focused={focused}
              onFocus={(key) =>
                setFocused((f) => {
                  const next = new Set(f);
                  if (!next.delete(key)) next.add(key);
                  return next;
                })
              }
              onHover={setHovered}
            />
          )}
          {children}
        </aside>
      </div>
    </WishesProvider>
  );
}
