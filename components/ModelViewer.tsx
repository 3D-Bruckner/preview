"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Facts } from "@/backend/client";
import { useCopy, useLocale } from "@/components/CopyProvider";
import { formatMm } from "@/components/format";
import { FitIcon, FullscreenIcon, GridIcon, ProblemIcon } from "@/components/icons";
import { useHydrated } from "@/components/useHydrated";
import type { CameraDirection, Size, View } from "@/components/viewer/scene";

type State = "loading" | "ready" | "error";

type Props = {
  src: string;
  label: string;
  facts: Facts;
  /** The part shown alone (null: all), the hidden ones and the one to light up: ModelReview's state. */
  focused?: string | null;
  hidden?: ReadonlySet<string>;
  hovered?: string | null;
  /** The filament colour picked per part (#rrggbb, by part key); a part not in it shows the file's colour. */
  colours?: ReadonlyMap<string, string>;
  /** What is shown, measured (for the chip), and where the view reports it. */
  size?: Size | null;
  onSize?: (size: Size) => void;
};

const NONE: ReadonlySet<string> = new Set();
const NO_COLOURS: ReadonlyMap<string, string> = new Map();

/** Paints the parts whose picked colour changed from `before` to `after`, and gives the others back their own. */
function paint(view: View, before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>) {
  for (const key of new Set([...before.keys(), ...after.keys()])) if (before.get(key) !== after.get(key)) view.setColour(key, after.get(key) ?? null);
}
const DIRECTIONS: CameraDirection[] = ["iso", "top", "front", "side"];
const tool =
  "inline-flex h-[30px] items-center justify-center rounded-[4px] text-sm hover:bg-surface aria-pressed:bg-surface aria-pressed:shadow-[inset_0_0_0_1px_var(--border)]";
const bar = "pointer-events-auto inline-flex gap-0.5 rounded-md border border-border bg-paper p-[3px]";

/**
 * The 3D view of a model's 3MF (`src`, the customer's own file route), named `label` for a screen reader, its meshes tagged with the
 * version's parts (`facts`). Turned by touch, mouse or keyboard; over it the view's tools (four directions, fit, grid, full screen) and
 * the measurements. It opens with a short turntable (a partial turn, then still; stopped by any touch, none for a visitor who turned
 * motion off). three loads only once the page runs. `data-state` and `data-rotating` on the view say what it is doing.
 */
export function ModelViewer(props: Props) {
  // A new file is a new view: its state starts over instead of showing the last one's.
  return <Viewer key={props.src} {...props} />;
}

function Viewer({ src, label, facts, focused = null, hidden = NONE, hovered = null, colours = NO_COLOURS, size = null, onSize }: Props) {
  const t = useCopy().customer;
  const lang = useLocale();
  const hydrated = useHydrated();
  const hint = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  const [state, setState] = useState<State>("loading");
  const [progress, setProgress] = useState<number | null>(null);
  const [rotating, setRotating] = useState(false);
  const [direction, setDirection] = useState<CameraDirection | null>("iso");
  const [grid, setGrid] = useState(true);
  // What the view must show once it opens, when the visitor picked it while the 3MF was still loading.
  const picked = useRef({ focused, hidden, hovered, colours, onSize });
  useEffect(() => {
    picked.current = { focused, hidden, hovered, colours, onSize };
  });
  // The colours the view shows now, to paint only what changed.
  const painted = useRef<ReadonlyMap<string, string>>(NO_COLOURS);

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
        opened = openView(el, data, facts, {
          autoRotate: !motion.matches,
          animate: !motion.matches,
          accent: getComputedStyle(el).getPropertyValue("--accent").trim() || undefined,
          onFirstFrame: () => setState("ready"),
          onRotating: setRotating,
          onError: () => setState("error"),
          onSize: (s) => picked.current.onSize?.(s),
          onUserMove: () => setDirection(null),
        });
        view.current = opened;
        const now = picked.current;
        if (now.hidden.size) opened.setHidden(now.hidden);
        if (now.focused) opened.focus(now.focused);
        if (now.hovered) opened.highlight(now.hovered);
        paint(opened, NO_COLOURS, now.colours);
        painted.current = now.colours;
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
    // The facts come with the file (`src` changes with the version): a new view is made only for a new file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => view.current?.setHidden(hidden), [hidden]);
  useEffect(() => view.current?.focus(focused), [focused]);
  useEffect(() => view.current?.highlight(hovered), [hovered]);
  useEffect(() => {
    if (!view.current) return;
    paint(view.current, painted.current, colours);
    painted.current = colours;
  }, [colours]);

  const ready = state === "ready";
  const turn = (dir: CameraDirection) => {
    view.current?.setCamera(dir);
    setDirection(dir);
  };
  const chip = size && size.x + size.y + size.z > 0 ? [size.x, size.y, size.z].map((v) => formatMm(v, lang)).join(" × ") : null;
  const canFullscreen = hydrated && document.fullscreenEnabled;

  return (
    <div ref={wrapper} className="min-w-0 bg-paper">
      {/* A flat stage with a 32 px grid, as in a slicer; not square, so the side panel fits beside it on a desktop. */}
      <div
        data-stage
        className="relative h-[380px] w-full overflow-hidden rounded-md border border-border bg-surface md:h-[560px] [:fullscreen_&]:h-[calc(100dvh-3rem)]"
        style={{
          backgroundImage: grid ? "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)" : "none",
          backgroundSize: "32px 32px",
          backgroundPosition: "center",
        }}
      >
        {/* The canvas goes in here (components/viewer/scene.ts). */}
        <div
          ref={mount}
          role="img"
          aria-label={label}
          aria-describedby={hint}
          data-threemf={src}
          data-state={state}
          data-rotating={rotating && ready}
          tabIndex={ready ? 0 : -1}
          onKeyDown={(e) => {
            if (!e.altKey && !e.ctrlKey && !e.metaKey && view.current?.key(e.key)) e.preventDefault();
          }}
          className="absolute inset-0 cursor-grab rounded-md outline-offset-[-3px] active:cursor-grabbing"
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
          <div role="alert" className="absolute inset-0 flex items-center justify-center gap-2 bg-surface p-8 text-center text-muted">
            <ProblemIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>{t.viewerError}</span>
          </div>
        )}
        {state !== "error" && (
          <div data-view-tools className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-2">
            <div role="group" aria-label={t.view.label} className={bar}>
              {DIRECTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!ready}
                  aria-pressed={direction === d}
                  onClick={() => turn(d)}
                  className={`${tool} px-2.5 text-muted aria-pressed:font-semibold aria-pressed:text-ink disabled:opacity-50`}
                >
                  {t.view[d]}
                </button>
              ))}
            </div>
            <div role="group" aria-label={t.view.tools} className={bar}>
              <button
                type="button"
                disabled={!ready}
                aria-label={t.view.fit}
                title={t.view.fit}
                onClick={() => {
                  view.current?.fit();
                  setDirection("iso");
                }}
                className={`${tool} w-8 disabled:opacity-50`}
              >
                <FitIcon aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t.view.grid}
                title={t.view.grid}
                aria-pressed={grid}
                onClick={() => setGrid((g) => !g)}
                className={`${tool} w-8`}
              >
                <GridIcon aria-hidden="true" className="size-4" />
              </button>
              {canFullscreen && (
                <button
                  type="button"
                  aria-label={t.view.fullscreen}
                  title={t.view.fullscreen}
                  onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void wrapper.current?.requestFullscreen())}
                  className={`${tool} w-8`}
                >
                  <FullscreenIcon aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
            <div
              data-testid="size-chip"
              aria-live="polite"
              className={`ml-auto hidden rounded-md border border-border bg-paper px-2.5 py-1.5 text-[0.8125rem] whitespace-nowrap text-muted tabular md:block ${chip ? "" : "invisible"}`}
            >
              <b className="font-semibold text-ink">{chip}</b> {t.dims.mm}
            </div>
          </div>
        )}
      </div>
      <p id={hint} className="mt-2 text-sm text-muted">
        {t.viewerHint}
      </p>
    </div>
  );
}
