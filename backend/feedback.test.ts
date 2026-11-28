// A customer's feedback on a version: through their link only, checked against the version's parts and the offered filaments, limited
// per customer, mailed to the operator when PREVIEW_FEEDBACK_EMAIL is set, and seen in the web app.
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCustomer, type Customer } from "./customers";
import { FEEDBACK_LIMITS, listFeedback, markFeedbackSeen, sendFeedback, unseenFeedback } from "./feedback";
import { createFilament, deleteFilament, updateFilament } from "./filaments";
import { addVersion } from "./files";
import { createModel, type Model } from "./models";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";

let rt: TestRuntime;
afterEach(() => rt.store.close());

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });

/** A customer with a model whose one version is plates.3mf (two parts), and two filaments, one offered. */
async function setUp(env: Record<string, string> = { PREVIEW_FEEDBACK_EMAIL: "feedback@example.com" }) {
  rt = testRuntime(env);
  rt.clock = () => now;
  const c = value(createCustomer(rt, { name: "Anna Beispiel" }));
  const m = value(createModel(rt, { customerId: c.id, title: "Spulenhalter" }));
  const v = value(await addVersion(rt, m.id, { threemf: fixture("plates.3mf"), preview: fixture("preview.png"), drawings: [] }));
  const parts = (JSON.parse(rt.store.version(v.id)!.facts!) as { parts: { key: string }[] }).parts.map((p) => p.key);
  const green = value(createFilament(rt, { name: "Bambu Grün", material: "PLA", color: "#00ae42" }));
  const hidden = value(createFilament(rt, { name: "Weiß", material: "PETG", color: "#ffffff", available: false }));
  return { c, m, v, parts, green, hidden, token: c.link! };
}

let now = new Date("2026-11-28T10:00:00Z");
const later = (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000));

describe("sending feedback", () => {
  it("stores a comment and colour wishes, the filament copied into the wish, and mails the operator", async () => {
    now = new Date("2026-11-28T10:00:00Z");
    const { m, parts, green, token } = await setUp();
    const f = value(
      await sendFeedback(rt, token, {
        modelId: m.id,
        versionNumber: 1,
        comment: "  Bitte etwas dicker.  ",
        wishes: [{ part: parts[0]!, filamentId: green.id }],
      }),
    );
    expect(f).toMatchObject({
      comment: "Bitte etwas dicker.",
      wishes: [{ part: parts[0], filament: { id: green.id, name: "Bambu Grün", material: "PLA", color: "#00ae42" } }],
      versionNumber: 1,
      modelTitle: "Spulenhalter",
      customerName: "Anna Beispiel",
      seenAt: null,
    });
    expect(rt.sent).toHaveLength(1);
    const mail = rt.sent[0]!;
    expect(mail.to).toBe("feedback@example.com");
    expect(mail.subject).toContain("Spulenhalter");
    expect(mail.text).toContain("Version 1");
    expect(mail.text).toContain("Bambu Grün (PLA · #00ae42)");
    expect(mail.text).toContain("Bitte etwas dicker.");
    expect(mail.text).toContain(`https://preview.example.com/models/${m.id}`);
  });

  it("keeps the wish's filament after the filament is deleted", async () => {
    const { m, parts, green, token } = await setUp();
    value(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, wishes: [{ part: parts[0]!, filamentId: green.id }] }));
    value(deleteFilament(rt, green.id));
    expect(listFeedback(rt, {})[0]!.wishes[0]!.filament).toEqual({ id: green.id, name: "Bambu Grün", material: "PLA", color: "#00ae42" });
  });

  it("refuses nothing to send, a comment over 2000 characters, an unknown part, a part twice, and a filament not offered", async () => {
    const { m, parts, green, hidden, token } = await setUp();
    const send = (input: { comment?: string; wishes?: { part: string; filamentId: string }[] }) =>
      sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, wishes: [], ...input });
    expect(await send({ comment: "   " })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await send({ comment: "x".repeat(2001) })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await send({ wishes: [{ part: "nope", filamentId: green.id }] })).toMatchObject({ ok: false, reason: "invalid" });
    expect(
      await send({
        wishes: [
          { part: parts[0]!, filamentId: green.id },
          { part: parts[0]!, filamentId: green.id },
        ],
      }),
    ).toMatchObject({ ok: false, reason: "invalid" });
    expect(await send({ wishes: [{ part: parts[0]!, filamentId: hidden.id }] })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await send({ wishes: [{ part: parts[0]!, filamentId: "deleted" }] })).toMatchObject({ ok: false, reason: "invalid" });
    expect(value(await send({ comment: "x".repeat(2000) })).comment).toHaveLength(2000);
    expect(listFeedback(rt, {})).toHaveLength(1);
    expect(rt.sent).toHaveLength(1);
  });

  it("answers another customer's model, an unknown version and an unknown token like a missing one", async () => {
    const { m, token } = await setUp();
    const other: Customer = value(createCustomer(rt, { name: "B" }));
    const theirs: Model = value(createModel(rt, { customerId: other.id, title: "Fremd" }));
    await addVersion(rt, theirs.id, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [] });
    expect(await sendFeedback(rt, token, { modelId: theirs.id, versionNumber: 1, comment: "hi", wishes: [] })).toMatchObject({
      ok: false,
      reason: "not_found",
    });
    expect(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 2, comment: "hi", wishes: [] })).toMatchObject({ ok: false, reason: "not_found" });
    expect(await sendFeedback(rt, "nope", { modelId: m.id, versionNumber: 1, comment: "hi", wishes: [] })).toMatchObject({ ok: false, reason: "not_found" });
    expect(listFeedback(rt, {})).toEqual([]);
  });

  it("takes 10 per customer an hour and 50 a day; the 11th is refused, unstored and unmailed", async () => {
    now = new Date("2026-11-28T00:00:00Z");
    const { m, token } = await setUp();
    expect(FEEDBACK_LIMITS).toEqual({ hour: 10, day: 50 });
    const send = () => sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, comment: "noch was", wishes: [] });
    for (let i = 0; i < 10; i++) value(await send());
    expect(await send()).toMatchObject({ ok: false, reason: "limited" });
    expect(listFeedback(rt, {})).toHaveLength(10);
    expect(rt.sent).toHaveLength(10);
    later(61);
    value(await send());
    // 50 within the day: four more hours of ten.
    for (let h = 0; h < 4; h++) {
      later(61);
      for (let i = 0; i < (h === 3 ? 9 : 10); i++) value(await send());
    }
    expect(listFeedback(rt, {})).toHaveLength(50);
    later(61);
    expect(await send()).toMatchObject({ ok: false, reason: "limited" });
  });

  it("stores the feedback when the mail fails, and logs without the address", async () => {
    const { m, token } = await setUp();
    rt.sendMail = async () => {
      throw Object.assign(new Error("550 feedback@example.com: Recipient address rejected"), { code: "EENVELOPE" });
    };
    const lines: unknown[] = [];
    // The real logger underneath (pino keeps its state on itself), only `error` caught.
    rt.log = Object.create(rt.log, { error: { value: (o: unknown) => void lines.push(o) } }) as typeof rt.log;
    value(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, comment: "hi", wishes: [] }));
    expect(listFeedback(rt, {})).toHaveLength(1);
    expect(JSON.stringify(lines)).not.toContain("example.com");
    expect(JSON.stringify(lines)).toContain("EENVELOPE");
  });

  it("sends no mail without PREVIEW_FEEDBACK_EMAIL", async () => {
    const { m, token } = await setUp({});
    value(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, comment: "hi", wishes: [] }));
    expect(rt.sent).toEqual([]);
  });

  it("works without filaments: a comment only, and a wish is refused", async () => {
    const { m, parts, green, hidden, token } = await setUp();
    value(deleteFilament(rt, green.id));
    value(updateFilament(rt, hidden.id, { available: false }));
    expect(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, wishes: [{ part: parts[0]!, filamentId: green.id }] })).toMatchObject({
      ok: false,
    });
    value(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, comment: "Passt so.", wishes: [] }));
  });
});

describe("reading feedback", () => {
  it("lists newest first, filters by customer, model and unseen, and marks seen", async () => {
    now = new Date("2026-11-28T10:00:00Z");
    const { c, m, token } = await setUp();
    const a = value(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, comment: "erste", wishes: [] }));
    later(1);
    const b = value(await sendFeedback(rt, token, { modelId: m.id, versionNumber: 1, comment: "zweite", wishes: [] }));
    expect(listFeedback(rt, {}).map((f) => f.id)).toEqual([b.id, a.id]);
    expect(listFeedback(rt, { customerId: c.id })).toHaveLength(2);
    expect(listFeedback(rt, { modelId: "other" })).toEqual([]);
    expect(unseenFeedback(rt)).toBe(2);
    expect(value(markFeedbackSeen(rt, [a.id]))).toEqual({ marked: 1 });
    expect(listFeedback(rt, { unseen: true }).map((f) => f.id)).toEqual([b.id]);
    expect(listFeedback(rt, {}).find((f) => f.id === a.id)!.seenAt).toBe(now.toISOString());
    // Seen again: already seen, nothing changes.
    expect(value(markFeedbackSeen(rt, [a.id]))).toEqual({ marked: 0 });
    expect(markFeedbackSeen(rt, ["nope"])).toMatchObject({ ok: false, reason: "not_found" });
    expect(unseenFeedback(rt)).toBe(1);
  });
});
