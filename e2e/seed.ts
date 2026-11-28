// Test data written through the domain, straight into the e2e server's data directory (playwright.config.ts's E2E_DATA_DIR): the server
// reads the same preview.sqlite and files, so what is seeded here is what its pages show.
import { join } from "node:path";
import { signInSettings } from "../backend/accounts";
import { loadConfig } from "../backend/config";
import { createCustomer, type Customer, type Language } from "../backend/customers";
import { sendFeedback } from "../backend/feedback";
import { createFilament, deleteFilament, listFilaments, type Filament } from "../backend/filaments";
import { addVersion } from "../backend/files";
import { log } from "../backend/log";
import { createModel, type Model } from "../backend/models";
import type { Outcome } from "../backend/outcome";
import { openRuntime, type Runtime } from "../backend/runtime";
import type { Version } from "../backend/versions";

const env = {
  PUBLIC_URL: "http://localhost",
  PREVIEW_SECRET: "e2e-seed-".padEnd(48, "x"),
  PREVIEW_SMTP_URL: "smtp://127.0.0.1:2525",
  DATA_DIR: process.env.E2E_DATA_DIR,
};
const mail = { texts: { en: { subject: () => "", body: () => "" } }, languageOf: () => "en" };

let rt: Runtime | undefined;
/** The test process's own runtime on the server's data directory. */
export const runtime = (): Runtime => (rt ??= openRuntime(loadConfig(env), signInSettings(env, env.DATA_DIR!, log), mail));

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`seed: ${o.reason}: ${o.message}`);
  return o.value;
}

// Playwright runs from the repository root.
export const FIXTURE = (name: string) => ({ path: join(process.cwd(), "backend", "fixtures", name) });

export const customer = (name: string, language: Language = "de"): Customer => value(createCustomer(runtime(), { name, language }));

export const model = (c: Customer, title: string, description?: string): Model =>
  value(createModel(runtime(), { customerId: c.id, title, ...(description ? { description } : {}) }));

export async function version(m: Model, input: { threemf?: string; note?: string; drawings?: string[] } = {}): Promise<Version> {
  return value(
    await addVersion(runtime(), m.id, {
      // A fixture by name, or a file a test made (an absolute path).
      threemf: input.threemf?.startsWith("/") ? { path: input.threemf } : FIXTURE(input.threemf ?? "ramp.3mf"),
      preview: FIXTURE("preview.png"),
      drawings: (input.drawings ?? []).map((d) => ({ path: d })),
      ...(input.note ? { note: input.note } : {}),
    }),
  );
}

/** A filament the customer can pick (or not, `available: false`). */
export const filament = (name: string, material: string, color: string, available = true): Filament =>
  value(createFilament(runtime(), { name, material, color, available }));

/** Leaves the filament list empty, as every test of it finds it. */
export function clearFilaments(): void {
  for (const f of listFilaments(runtime())) value(deleteFilament(runtime(), f.id));
}

/** A customer's comment on a version, sent as their page sends it. */
export async function feedback(c: Customer, m: Model, versionNumber: number, comment: string): Promise<void> {
  value(await sendFeedback(runtime(), c.link!, { modelId: m.id, versionNumber, comment, wishes: [] }));
}
