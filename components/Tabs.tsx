"use client";
// Tabs (the ARIA tab pattern, conventions: code/accessibility): a tablist whose arrows, Home and End move between tabs and stop there,
// the open tab marked by aria-selected, in bold on a raised segment, not by colour alone. The panels come rendered from the
// server; the open one is kept in the URL's ?tab=, so a reload or the back button returns to it.
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export function Tabs({ label, tabs, initial }: { label: string; tabs: { id: string; label: string; panel: ReactNode }[]; initial: string }) {
  const [open, setOpen] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0]!.id);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(id: string, focus = false) {
    setOpen(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
    if (focus) refs.current[tabs.findIndex((t) => t.id === id)]?.focus();
  }

  function onKey(e: KeyboardEvent, i: number) {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    choose(tabs[(to + tabs.length) % tabs.length]!.id, true);
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-surface p-1">
        {tabs.map((t, i) => {
          const selected = t.id === open;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`tabular min-h-10 rounded-md px-3 text-[0.9375rem] ${selected ? "bg-paper font-bold text-ink shadow-sm ring-1 ring-border" : "font-medium text-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={t.id !== open} className="pt-2">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
