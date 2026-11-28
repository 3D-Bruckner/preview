// A customer's feedback on a version of one of their models: a comment and colour wishes (a filament for a part). Sent from the
// customer's page, so it starts from customerByToken like every read there (conventions: architecture/one-gate-for-every-read): a model
// or version that isn't the token's customer's is refused like a missing one. Each wish is checked against the version's parts and the
// filaments offered now, and keeps a copy of its filament, so deleting a filament later keeps what was wished. A customer may send
// FEEDBACK_LIMITS per hour and per day. When PREVIEW_FEEDBACK_EMAIL is set the operator gets a mail; a failed mail is logged (without
// the address) and loses nothing: the feedback is stored, and the web app shows it. Logs never carry the comment.
import { randomUUID } from "node:crypto";
import { customerByToken } from "./customers";
import type { FeedbackListRow } from "./db";
import { factsOf } from "./facts";
import { listFilaments } from "./filaments";
import { invalid, limited, notFound, ok, type Outcome } from "./outcome";
import { mutation, type Runtime } from "./runtime";

export const FEEDBACK_COMMENT_MAX = 2000;
export const FEEDBACK_LIMITS = { hour: 10, day: 50 };

/** A colour wish: the part (its key in the version's facts) and the filament as it was when the wish was sent. */
export type Wish = { part: string; partName: string | null; filament: { id: string; name: string; material: string; color: string } };

export type Feedback = {
  id: string;
  versionId: string;
  versionNumber: number;
  modelId: string;
  modelTitle: string;
  customerId: string;
  customerName: string;
  comment: string | null;
  wishes: Wish[];
  createdAt: string;
  /** When the operator saw it in the web app; null: new. */
  seenAt: string | null;
};

export type FeedbackInput = { modelId: string; versionNumber: number; comment?: string; wishes: { part: string; filamentId: string }[] };

const feedback = (r: FeedbackListRow): Feedback => ({
  id: r.id,
  versionId: r.version_id,
  versionNumber: r.version_number,
  modelId: r.model_id,
  modelTitle: r.model_title,
  customerId: r.customer_id,
  customerName: r.customer_name,
  comment: r.comment,
  wishes: JSON.parse(r.wishes) as Wish[],
  createdAt: r.created_at,
  seenAt: r.seen_at,
});

const ago = (now: Date, hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

/** Stores a customer's feedback on one version of their model, and mails the operator (PREVIEW_FEEDBACK_EMAIL). */
export async function sendFeedback(rt: Runtime, token: string, input: FeedbackInput): Promise<Outcome<Feedback>> {
  const customer = customerByToken(rt, token);
  const model = customer ? rt.store.model(input.modelId) : undefined;
  if (!customer || !model || model.customer_id !== customer.id) return notFound("No such model.");
  const version = rt.store.versionsOfModel(model.id).find((v) => v.number === input.versionNumber);
  if (!version) return notFound("No such version.");

  const comment = input.comment?.trim() || null;
  if (comment && comment.length > FEEDBACK_COMMENT_MAX) return invalid(`comment: at most ${FEEDBACK_COMMENT_MAX} characters`);
  const parts = new Map((factsOf(version)?.parts ?? []).map((p) => [p.key, p]));
  const offered = new Map(listFilaments(rt, { available: true }).map((f) => [f.id, f]));
  const wishes: Wish[] = [];
  for (const w of input.wishes) {
    const part = parts.get(w.part);
    const f = offered.get(w.filamentId);
    if (!part) return invalid(`wishes: the version has no part ${w.part}`);
    if (!f) return invalid("wishes: that filament isn't offered (any more)");
    if (wishes.some((x) => x.part === w.part)) return invalid(`wishes: part ${w.part} twice`);
    wishes.push({ part: part.key, partName: part.name, filament: { id: f.id, name: f.name, material: f.material, color: f.color } });
  }
  if (!comment && wishes.length === 0) return invalid("feedback: a comment or a colour wish");

  const stored = mutation(rt, () => {
    const now = rt.clock();
    if (rt.store.feedbackCountSince(customer.id, ago(now, 1)) >= FEEDBACK_LIMITS.hour) return limited("feedback: at most 10 an hour");
    if (rt.store.feedbackCountSince(customer.id, ago(now, 24)) >= FEEDBACK_LIMITS.day) return limited("feedback: at most 50 a day");
    const id = randomUUID();
    rt.store.insertFeedback({
      id,
      version_id: version.id,
      customer_id: customer.id,
      comment,
      wishes: JSON.stringify(wishes),
      created_at: now.toISOString(),
      seen_at: null,
    });
    return ok(feedback(rt.store.feedback({ versionIds: [version.id] }).find((r) => r.id === id)!));
  });
  if (!stored.ok) return stored;
  rt.log.info({ feedback: stored.value.id, version: version.id, wishes: wishes.length, comment: comment !== null }, "feedback");
  await mailOperator(rt, stored.value);
  return stored;
}

/** The operator's mail about a feedback, in German (the operator's language; the web app shows it in theirs). */
export function feedbackMail(publicUrl: string, f: Feedback): { subject: string; text: string } {
  const lines = [`${f.customerName} hat zu „${f.modelTitle}“, Version ${f.versionNumber}, eine Rückmeldung geschickt.`, ""];
  if (f.wishes.length > 0) {
    lines.push("Farbwünsche:");
    for (const w of f.wishes) lines.push(`- ${w.partName ?? w.part}: ${w.filament.name} (${w.filament.material} · ${w.filament.color})`);
    lines.push("");
  }
  if (f.comment) lines.push("Kommentar:", f.comment, "");
  lines.push(`In der Web-App: ${publicUrl}/models/${f.modelId}`);
  return { subject: `Rückmeldung zu „${f.modelTitle}“, Version ${f.versionNumber}`, text: lines.join("\n") };
}

async function mailOperator(rt: Runtime, f: Feedback): Promise<void> {
  const to = rt.config.feedbackEmail;
  if (!to) return;
  try {
    await rt.sendMail({ to, ...feedbackMail(rt.config.publicUrl, f) });
  } catch (e) {
    // The error's message may name the address; its code doesn't.
    const code = (e as { code?: unknown } | null)?.code;
    rt.log.error({ feedback: f.id, code: typeof code === "string" ? code : "unknown" }, "feedback mail not sent");
  }
}

/** Feedback newest first: all, one customer's, one model's, only the unseen. */
export function listFeedback(rt: Runtime, filter: { customerId?: string; modelId?: string; unseen?: boolean }): Feedback[] {
  return rt.store.feedback(filter).map(feedback);
}

/** The feedback on these versions, newest first. */
export function feedbackOfVersions(rt: Runtime, versionIds: string[]): Feedback[] {
  return rt.store.feedback({ versionIds }).map(feedback);
}

/** Marks feedback as seen by the operator; already seen stays as it was. Refused when none of `ids` exists. */
export function markFeedbackSeen(rt: Runtime, ids: string[]): Outcome<{ marked: number }> {
  return mutation(rt, () => {
    if (ids.length > 0 && rt.store.feedbackIds(ids).length === 0) return notFound("No such feedback.");
    return ok({ marked: rt.store.markFeedbackSeen(ids, rt.clock().toISOString()) });
  });
}

/** How many feedback the operator hasn't seen yet. */
export function unseenFeedback(rt: Runtime): number {
  return rt.store.unseenFeedbackCount();
}
