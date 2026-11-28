// When a customer looked: the last time they opened their link, and per version the last time they viewed it. Recorded by the customer
// pages (app/[lang]/(customer)/k/[token]/…) only for a visitor who is not signed in to the web app, so the operator's own look ("Öffnen",
// "Wie <Name> es sieht") never counts; the page decides that, this module records. Like every customer read it starts from
// customerByToken, and a version that is not the token's customer's records nothing.
import { customerByToken } from "./customers";
import type { Runtime } from "./runtime";

/** Records that the token's customer looked now: at their page, and at `versionId` when given. False when nothing was recorded. */
export function recordView(rt: Runtime, token: string, versionId?: string): boolean {
  const customer = customerByToken(rt, token);
  if (!customer) return false;
  const version = versionId === undefined ? undefined : rt.store.version(versionId);
  if (versionId !== undefined && (!version || rt.store.model(version.model_id)?.customer_id !== customer.id)) return false;
  const now = rt.clock().toISOString();
  rt.store.transaction(() => {
    rt.store.setCustomerSeen(customer.id, now);
    if (version) rt.store.setVersionSeen(version.id, now);
  });
  return true;
}

/** When the customer last viewed any version of the model: the newest of its versions' times; null when never. */
export function modelSeenAt(rt: Runtime, modelId: string): string | null {
  const ids = rt.store.versionsOfModel(modelId).map((v) => v.id);
  return (
    rt.store
      .versionsSeen(ids)
      .map((s) => s.seen_at)
      .sort()
      .at(-1) ?? null
  );
}
