import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomer, customerByToken, getCustomer, listCustomers, renewLink, revokeLink, updateCustomer } from "./customers";
import type { Outcome } from "./outcome";
import { testRuntime, type TestRuntime } from "./testing/runtime";

let rt: TestRuntime;
beforeEach(() => {
  rt = testRuntime();
});
afterEach(() => rt.store.close());

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}

describe("customers", () => {
  it("creates one with a 32-character base64url link, German by default", () => {
    const c = value(createCustomer(rt, { name: " Anna " }));
    expect(c).toMatchObject({ name: "Anna", note: null, language: "de" });
    expect(c.link).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(customerByToken(rt, c.link!)).toEqual(c);
  });

  it("gives two customers different links", () => {
    const a = value(createCustomer(rt, { name: "A" }));
    const b = value(createCustomer(rt, { name: "B", language: "en" }));
    expect(a.link).not.toBe(b.link);
    expect(b.language).toBe("en");
  });

  it("refuses an empty name or an unknown language", () => {
    const r = createCustomer(rt, { name: "  " });
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
    expect(createCustomer(rt, { name: "A", language: "fr" as never })).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("renews the link: the old one stops working", () => {
    const c = value(createCustomer(rt, { name: "A" }));
    const r = value(renewLink(rt, c.id));
    expect(r.link).not.toBe(c.link);
    expect(customerByToken(rt, c.link!)).toBeNull();
    expect(customerByToken(rt, r.link!)?.id).toBe(c.id);
  });

  it("revokes the link", () => {
    const c = value(createCustomer(rt, { name: "A" }));
    expect(value(revokeLink(rt, c.id)).link).toBeNull();
    expect(customerByToken(rt, c.link!)).toBeNull();
    expect(value(getCustomer(rt, c.id)).link).toBeNull();
    // A revoked customer gets a link again by renewing.
    expect(value(renewLink(rt, c.id)).link).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("answers null for a token that is empty or unknown", () => {
    expect(customerByToken(rt, "")).toBeNull();
    expect(customerByToken(rt, "x".repeat(32))).toBeNull();
  });

  it("updates, lists by name and says not_found for an unknown id", () => {
    const c = value(createCustomer(rt, { name: "B" }));
    value(createCustomer(rt, { name: "A" }));
    expect(value(updateCustomer(rt, c.id, { note: "VIP", language: "en" }))).toMatchObject({ name: "B", note: "VIP", language: "en" });
    expect(updateCustomer(rt, c.id, { name: "" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(listCustomers(rt).map((x) => x.name)).toEqual(["A", "B"]);
    for (const r of [getCustomer(rt, "nope"), updateCustomer(rt, "nope", {}), renewLink(rt, "nope"), revokeLink(rt, "nope")])
      expect(r).toMatchObject({ ok: false, reason: "not_found" });
  });
});
