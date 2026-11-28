"use client";
import { useState, type ReactNode } from "react";
import type { Facts } from "@/backend/client";
import { Dimensions } from "@/components/Dimensions";
import { ModelViewer } from "@/components/ModelViewer";
import { PartsList, usePartLabels } from "@/components/PartsList";
import type { Size } from "@/components/viewer/scene";

/**
 * A model page's review: the 3D view beside the side panel's Maße and Teile cards (then `children`, the page's own cards). The one place
 * that holds what the visitor picked: the focused part, the hidden ones and the one under the pointer, and the shown size.
 */
export function ModelReview({
  src,
  label,
  facts,
  print,
  children,
}: {
  src: string;
  label: string;
  facts: Facts;
  /** The Druck card (PrintFigures), between Maße and Teile. */
  print?: ReactNode;
  children: ReactNode;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const labels = usePartLabels(facts);
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ModelViewer key={src} src={src} label={label} facts={facts} focused={focused} hidden={hidden} hovered={hovered} size={size} onSize={setSize} />
      <aside className="grid min-w-0 gap-4">
        <Dimensions size={size} scope={focused ? (labels.get(focused) ?? null) : null} />
        {print}
        {facts.parts.length > 0 && (
          <PartsList
            facts={facts}
            labels={labels}
            focused={focused}
            hidden={hidden}
            onFocus={(key) => setFocused((f) => (f === key ? null : key))}
            onToggle={(key) =>
              setHidden((h) => {
                const next = new Set(h);
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
  );
}
