// The slicing service's client and its worker, in the server's process (started from instrumentation.ts when PREVIEW_SLICER_URL is set).
// The worker gives every version whose 3MF has no print figures of its own a job (slice_jobs), then works the due jobs one at a time:
// it posts the 3MF to the service's POST /estimate and keeps the answer as the version's figures. A busy or limited service (429, 5xx, a
// timeout, no answer) is asked again after BACKOFF_MINUTES, 5 attempts in all over about an hour; a refusal (400, 413, 422, …) is final.
// Logs carry the version's id, never the file's name.
import { readFileSync, statSync } from "node:fs";
import * as z from "zod";
import { factsOf } from "./facts";
import { versionFile } from "./files";
import type { Runtime } from "./runtime";
import type { FactsFigures } from "./threemf";

/** The service takes files up to 50 MB. */
export const SLICER_MAX_BYTES = 50 * 1024 * 1024;
/** The waits after the 1st to 4th busy answer; the 5th ends the job. 60 minutes in all. */
export const BACKOFF_MINUTES = [5, 10, 15, 30];
const ATTEMPTS = BACKOFF_MINUTES.length + 1;
/** The service slices for up to 120 s, after the upload and the wait in its queue. */
const TIMEOUT_MS = 180_000;
/** The answers that are worth another try later. */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

const estimateSchema = z.object({
  ok: z.literal(true),
  grams: z.number().nonnegative(),
  minutes: z.number().nonnegative(),
  filaments: z.array(z.object({ slot: z.number().int().min(1), type: z.string(), color: z.string(), grams: z.number().nonnegative() })),
});

/** Every version that has read facts without figures of their own and no job yet gets a pending one; how many did. */
export function enqueueMissing(rt: Runtime): number {
  const jobs = new Set(rt.store.sliceJobIds());
  const now = rt.clock().toISOString();
  let added = 0;
  for (const row of rt.store.versionFacts()) {
    const facts = factsOf(row);
    if (!facts || facts.figures || jobs.has(row.id)) continue;
    rt.store.putSliceJob(row.id, now);
    added++;
  }
  return added;
}

/** What a file is sliced in: its first part's filament when that is PLA or PETG, else the setting. */
function materialOf(rt: Runtime, versionId: string, fallback: "PLA" | "PETG"): "PLA" | "PETG" {
  const facts = factsOf(rt.store.version(versionId) ?? { facts: null });
  const slot = facts?.parts[0]?.slot;
  const type = slot ? facts?.slots[slot - 1]?.type?.toUpperCase() : undefined;
  return type === "PLA" || type === "PETG" ? type : fallback;
}

type Answer = { done: FactsFigures } | { final: string } | { again: string };

async function ask(rt: Runtime, versionId: string): Promise<Answer> {
  const slicer = rt.config.slicer!;
  const file = versionFile(rt, versionId, "3mf");
  if (!file.ok) return { final: "no_file" };
  if (statSync(file.value.path).size > SLICER_MAX_BYTES) return { final: "too_large" };
  const form = new FormData();
  form.set("file", new Blob([readFileSync(file.value.path)], { type: "model/3mf" }), "model.3mf");
  form.set("material", materialOf(rt, versionId, slicer.material));
  let res: Response;
  try {
    res = await rt.fetch(`${slicer.url}/estimate`, {
      method: "POST",
      body: form,
      headers: slicer.token ? { authorization: `Bearer ${slicer.token}` } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { again: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "slicer_down" };
  }
  const body: unknown = await res.json().catch(() => null);
  const reason = (body as { reason?: unknown } | null)?.reason;
  const named = typeof reason === "string" && /^[a-z_]{1,40}$/.test(reason) ? reason : `http_${res.status}`;
  if (TRANSIENT.has(res.status)) return { again: named };
  if (!res.ok) return { final: named };
  const e = estimateSchema.safeParse(body);
  if (!e.success) return { final: "bad_answer" };
  return {
    done: {
      seconds: Math.round(e.data.minutes * 60),
      grams: e.data.grams,
      filaments: e.data.filaments.map((f) => ({
        slot: f.slot,
        type: f.type || null,
        color: /^#[0-9a-f]{6}/i.test(f.color) ? f.color.slice(0, 7).toLowerCase() : null,
        grams: f.grams,
      })),
    },
  };
}

/** Works the pending job due first, if there is one; whether there was. */
export async function sliceNext(rt: Runtime): Promise<boolean> {
  const job = rt.store.dueSliceJob(rt.clock().toISOString());
  if (!job) return false;
  const started = Date.now();
  const answer = await ask(rt, job.version_id);
  const now = rt.clock();
  const attempts = job.attempts + 1;
  const at = now.toISOString();
  if ("done" in answer) {
    rt.store.updateSliceJob(job.version_id, { state: "done", attempts, figures: JSON.stringify(answer.done), reason: null, updated_at: at });
  } else if ("again" in answer && attempts < ATTEMPTS) {
    const next = new Date(now.getTime() + BACKOFF_MINUTES[attempts - 1]! * 60_000).toISOString();
    rt.store.updateSliceJob(job.version_id, { attempts, next_at: next, reason: answer.again, updated_at: at });
  } else {
    rt.store.updateSliceJob(job.version_id, { state: "failed", attempts, reason: "again" in answer ? answer.again : answer.final, updated_at: at });
  }
  const outcome = "done" in answer ? "done" : "again" in answer ? `again: ${answer.again}` : `failed: ${answer.final}`;
  rt.log.info({ version: job.version_id, attempt: attempts, ms: Date.now() - started, outcome }, "slicer");
  return true;
}

export type SliceWorker = {
  /** Gives the versions without figures their jobs and works every due one; resolves when done (a running pass is joined). */
  tick(): Promise<void>;
  stop(): void;
};

/** Starts the worker: a pass now, then every `pollMs` and whenever rt.wakeSlicer() is called. */
export function startSliceWorker(rt: Runtime, { pollMs }: { pollMs: number }): SliceWorker {
  let stopped = false;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const pass = async () => {
    do {
      again = false;
      enqueueMissing(rt);
      while (!stopped && (await sliceNext(rt)));
    } while (again && !stopped);
  };
  const tick = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = pass()
      .catch((e) => rt.log.error({ error: e instanceof Error ? e.message : String(e) }, "slicer worker"))
      .finally(() => {
        running = null;
      });
    return running;
  };
  const loop = () => {
    if (stopped) return;
    void tick().finally(() => {
      if (!stopped) timer = setTimeout(loop, pollMs);
    });
  };
  rt.wakeSlicer = () => void tick();
  timer = setTimeout(loop, 0);
  return {
    tick,
    stop() {
      stopped = true;
      clearTimeout(timer);
      rt.wakeSlicer = () => {};
    },
  };
}
