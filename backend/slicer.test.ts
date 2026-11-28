// The slicer's worker against a fake service (rt.fetch) and a clock of the test's own: what it asks, what it keeps, when it tries again.
import { truncateSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer } from "./customers";
import { resliceVersion, versionFigures } from "./figures";
import { addVersion, versionFile } from "./files";
import { createModel } from "./models";
import type { Outcome } from "./outcome";
import { BACKOFF_MINUTES, enqueueMissing, sliceNext, startSliceWorker } from "./slicer";
import { testRuntime, type TestRuntime } from "./testing/runtime";

const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });
const SLICER = { PREVIEW_SLICER_URL: "https://slicing.test/", PREVIEW_SLICER_TOKEN: "secret-token" };

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

type Call = { url: string; auth: string | null; material: string | null; size: number };
let rt: TestRuntime;
let modelId: string;
let now: Date;
let calls: Call[];
let answers: (() => Response | Promise<Response>)[];

const estimate = (body: object = {}) =>
  Response.json({
    ok: true,
    grams: 12.5,
    minutes: 42,
    material: "PLA",
    multicolor: false,
    filaments: [{ slot: 1, type: "PLA", color: "#D62828", grams: 12.5 }],
    price: { exact: 1, customer: 2, low: 1, high: 3 },
    ...body,
  });
const refusal = (status: number, reason: string) => Response.json({ ok: false, reason, message: "nope" }, { status });

function setUp(env: Record<string, string> = SLICER) {
  rt = testRuntime(env);
  now = new Date("2026-11-28T10:00:00Z");
  rt.clock = () => now;
  calls = [];
  answers = [];
  rt.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    const file = form.get("file") as File;
    calls.push({ url: String(url), auth: new Headers(init?.headers).get("authorization"), material: form.get("material") as string | null, size: file.size });
    const next = answers.shift();
    if (!next) throw new Error("no answer queued");
    return next();
  }) as typeof fetch;
  const c = value(createCustomer(rt, { name: "A" }));
  modelId = value(createModel(rt, { customerId: c.id, title: "Rampe" })).id;
}

const upload = async (name = "ramp.3mf") => value(await addVersion(rt, modelId, { threemf: fixture(name), preview: fixture("preview.png"), drawings: [] }));
const later = (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000));

afterEach(() => rt.store.close());

describe("the slicer's worker", () => {
  beforeEach(() => setUp());

  it("asks the service for a version without figures and keeps its answer as the version's figures", async () => {
    const v = await upload();
    expect(versionFigures(rt, v.id)).toEqual({ figures: null, slicing: "pending", reason: null });
    expect(enqueueMissing(rt)).toBe(1);
    answers.push(() => estimate());
    expect(await sliceNext(rt)).toBe(true);
    expect(calls).toEqual([{ url: "https://slicing.test/estimate", auth: "Bearer secret-token", material: "PLA", size: expect.any(Number) }]);
    expect(versionFigures(rt, v.id)).toEqual({
      figures: { source: "slicer", seconds: 2520, grams: 12.5, filaments: [{ slot: 1, type: "PLA", color: "#d62828", grams: 12.5 }] },
      slicing: null,
      reason: null,
    });
    expect(await sliceNext(rt)).toBe(false);
    expect(enqueueMissing(rt)).toBe(0);
  });

  it("gives a version with its own figures no job, and answers them from the file", async () => {
    const v = await upload("plates.3mf");
    expect(enqueueMissing(rt)).toBe(0);
    expect(versionFigures(rt, v.id)).toMatchObject({ figures: { source: "file", seconds: 5400, grams: 29.75 }, slicing: null });
    expect(resliceVersion(rt, v.id)).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("tries a busy service again after the backoff, and gives up after the fifth attempt with its reason", async () => {
    const v = await upload();
    enqueueMissing(rt);
    for (let attempt = 1; attempt <= 5; attempt++) {
      answers.push(() => refusal(503, "busy"));
      expect(await sliceNext(rt)).toBe(true);
      if (attempt < 5) {
        expect(versionFigures(rt, v.id).slicing).toBe("pending");
        expect(await sliceNext(rt)).toBe(false);
        later(BACKOFF_MINUTES[attempt - 1]!);
      }
    }
    expect(calls).toHaveLength(5);
    expect(BACKOFF_MINUTES.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(60);
    expect(versionFigures(rt, v.id)).toEqual({ figures: null, slicing: "failed", reason: "busy" });
  });

  it("tries again after a 429, a timeout and a network failure too", async () => {
    const v = await upload();
    enqueueMissing(rt);
    answers.push(() => refusal(429, "rate_limited"));
    await sliceNext(rt);
    later(BACKOFF_MINUTES[0]!);
    answers.push(() => {
      throw new TypeError("fetch failed");
    });
    await sliceNext(rt);
    later(BACKOFF_MINUTES[1]!);
    answers.push(() => refusal(504, "timeout"));
    await sliceNext(rt);
    later(BACKOFF_MINUTES[2]!);
    answers.push(() => estimate());
    await sliceNext(rt);
    expect(calls).toHaveLength(4);
    expect(versionFigures(rt, v.id).figures?.source).toBe("slicer");
  });

  it("takes a 422 as final, with the service's reason", async () => {
    const v = await upload();
    enqueueMissing(rt);
    answers.push(() => refusal(422, "off_plate"));
    await sliceNext(rt);
    later(120);
    expect(await sliceNext(rt)).toBe(false);
    expect(versionFigures(rt, v.id)).toEqual({ figures: null, slicing: "failed", reason: "off_plate" });
  });

  it("fails an answer that isn't an estimate, instead of storing it", async () => {
    const v = await upload();
    enqueueMissing(rt);
    answers.push(() => new Response("<html>gateway</html>", { status: 200, headers: { "content-type": "text/html" } }));
    await sliceNext(rt);
    expect(versionFigures(rt, v.id)).toEqual({ figures: null, slicing: "failed", reason: "bad_answer" });
  });

  it("fails a file over 50 MB without asking", async () => {
    const v = await upload();
    truncateSync(value(versionFile(rt, v.id, "3mf")).path, 50 * 1024 * 1024 + 1);
    enqueueMissing(rt);
    await sliceNext(rt);
    expect(calls).toHaveLength(0);
    expect(versionFigures(rt, v.id)).toEqual({ figures: null, slicing: "failed", reason: "too_large" });
  });

  it("slices in the file's first filament when it is PLA or PETG", async () => {
    await upload("plates.3mf");
    const v = await upload();
    // ramp.3mf names no material: the setting's.
    enqueueMissing(rt);
    answers.push(() => estimate());
    await sliceNext(rt);
    expect(calls[0]!.material).toBe("PLA");
    // plates.3mf's first part prints in slot 2, PETG; with its figures removed it is sliced as PETG.
    const facts = JSON.parse(rt.store.versionFacts().find((r) => r.id !== v.id)!.facts!);
    rt.store.setFacts(rt.store.versionFacts().find((r) => r.id !== v.id)!.id, JSON.stringify({ ...facts, parts: [facts.parts[1]], figures: null }));
    enqueueMissing(rt);
    answers.push(() => estimate());
    await sliceNext(rt);
    expect(calls[1]!.material).toBe("PETG");
  });

  it("Neu berechnen puts a failed version back in line, at once", async () => {
    const v = await upload();
    enqueueMissing(rt);
    answers.push(() => refusal(422, "unsliceable"));
    await sliceNext(rt);
    expect(value(resliceVersion(rt, v.id))).toEqual({ slicing: "pending" });
    expect(versionFigures(rt, v.id)).toEqual({ figures: null, slicing: "pending", reason: null });
    answers.push(() => estimate());
    expect(await sliceNext(rt)).toBe(true);
    expect(versionFigures(rt, v.id).figures?.grams).toBe(12.5);
  });

  it("the worker works every due job when woken, and the slicer's figures survive a re-read of the facts", async () => {
    const worker = startSliceWorker(rt, { pollMs: 60_000 });
    try {
      // The upload wakes the worker itself: the service's answers are ready before.
      answers.push(
        () => estimate(),
        () => estimate({ grams: 3 }),
      );
      const a = await upload();
      const b = await upload();
      rt.wakeSlicer();
      await worker.tick();
      expect(versionFigures(rt, a.id).figures?.grams).toBe(12.5);
      expect(versionFigures(rt, b.id).figures?.grams).toBe(3);
      const { rereadFacts } = await import("./facts");
      value(rereadFacts(rt, a.id));
      expect(versionFigures(rt, a.id).figures?.grams).toBe(12.5);
    } finally {
      worker.stop();
    }
  });
});

describe("without a slicer", () => {
  beforeEach(() => setUp({}));

  it("shows nothing as pending and refuses Neu berechnen", async () => {
    const v = await upload();
    expect(versionFigures(rt, v.id)).toEqual({ figures: null, slicing: null, reason: null });
    expect(resliceVersion(rt, v.id)).toMatchObject({ ok: false, reason: "invalid" });
  });
});
