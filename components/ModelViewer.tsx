"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useCopy } from "@/components/CopyProvider";
import { ProblemIcon, ResetViewIcon } from "@/components/icons";
import type { View } from "@/components/viewer/scene";

type State = "loading" | "ready" | "error";

/**
 * The 3D view of a model's 3MF (`src`, the customer's own file route), named `label` for a screen reader. Turned by touch, mouse or
 * keyboard; a slow turntable until the visitor moves it, none for a visitor who turned motion off. three loads only once the page runs.
 */
export function ModelViewer({ src, label }: { src: string; label: string }) {
  // A new file is a new view: its state starts over instead of showing the last one's.
  return <Viewer key={src} src={src} label={label} />;
}

function Viewer({ src, label }: { src: string; label: string }) {
  const t = useCopy().customer;
  const hint = useId();
  const mount = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  const [state, setState] = useState<State>("loading");
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const el = mount.current!;
    const abort = new AbortController();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let opened: View | undefined;
    (async () => {
      try {
        const { fetchModel, openView } = await import("@/components/viewer/scene");
        const data = await fetchModel(src, abort.signal, setProgress);
        if (abort.signal.aborted) return;
        opened = openView(el, data, { autoRotate: !motion.matches, onFirstFrame: () => setState("ready") });
        view.current = opened;
      } catch {
        if (!abort.signal.aborted) setState("error");
      }
    })();
    const onMotion = () => opened?.setAutoRotate(!motion.matches);
    motion.addEventListener("change", onMotion);
    return () => {
      abort.abort();
      motion.removeEventListener("change", onMotion);
      opened?.dispose();
      view.current = null;
    };
  }, [src]);

  return (
    <div className="mt-5">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface"
        style={{ backgroundImage: "radial-gradient(circle at 50% 38%, var(--bg), var(--surface) 72%)" }}
      >
        {/* The canvas goes in here (components/viewer/scene.ts). */}
        <div
          ref={mount}
          role="img"
          aria-label={label}
          aria-describedby={hint}
          data-threemf={src}
          data-state={state}
          tabIndex={state === "ready" ? 0 : -1}
          onKeyDown={(e) => {
            if (!e.altKey && !e.ctrlKey && !e.metaKey && view.current?.key(e.key)) e.preventDefault();
          }}
          className="absolute inset-0 cursor-grab rounded-xl outline-offset-[-3px] active:cursor-grabbing"
        />
        {state === "loading" && (
          <div role="status" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted">
            <span>{t.viewerLoading}</span>
            <span aria-hidden="true" className="h-1 w-32 overflow-hidden rounded-full bg-border">
              <span className="block h-full bg-accent transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
            </span>
          </div>
        )}
        {state === "error" && (
          <div role="alert" className="absolute inset-0 flex items-center justify-center gap-2 p-8 text-center text-muted">
            <ProblemIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>{t.viewerError}</span>
          </div>
        )}
        {state !== "error" && (
          <button
            type="button"
            disabled={state !== "ready"}
            onClick={() => view.current?.reset()}
            className="absolute top-3 right-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper/90 px-3.5 text-sm font-medium text-ink shadow-sm backdrop-blur hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ResetViewIcon aria-hidden="true" className="size-4 shrink-0" />
            {t.reset}
          </button>
        )}
      </div>
      <p id={hint} className="mt-2 text-sm text-muted">
        {t.viewerHint}
      </p>
    </div>
  );
}
