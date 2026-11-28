// The MCP tools (backend/mcp.ts) through the kit's MCP server, as /mcp serves them (callTool: schemas and all, without a token): each
// tool's result with its guidance, and the tools acting for their caller.
import { mcpRoute, type McpContext, type Who } from "next-app-kit/mcp";
import { callTool, signedInCookie } from "next-app-kit/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { createCustomer } from "./customers";
import { addVersion } from "./files";
import { MCP_INSTRUCTIONS, mcpContext } from "./mcp";
import { createModel } from "./models";
import type { Outcome } from "./outcome";
import { OWNER, testRuntime, type TestRuntime } from "./testing/runtime";

let rt: TestRuntime;
let ctx: McpContext;
beforeEach(async () => {
  rt = testRuntime();
  ctx = await mcpContext(rt);
});
afterEach(() => rt.store.close());

const BASE = "https://preview.example.com";

type Result = Record<string, unknown> & { guidance: string[] };

/** A tool's result; throws with the refusal's text when it refused. */
async function tool<T = Result>(name: string, input: Record<string, unknown>, as: Who): Promise<T & { guidance: string[] }> {
  const r = await callTool(ctx, as, name, input);
  if (r.isError) throw new Error(`${name} refused: ${JSON.stringify(r.content)}`);
  const out = r.structuredContent as T & { guidance: string[] };
  expect(Array.isArray(out.guidance), `${name}'s guidance`).toBe(true);
  expect(out.guidance.length, `${name}'s guidance`).toBeGreaterThan(0);
  return out;
}

/** A tool's refusal text; fails when it didn't refuse. */
async function refusal(name: string, input: Record<string, unknown>, as: Who): Promise<string> {
  const r = await callTool(ctx, as, name, input);
  expect(r.isError, `${name} should refuse`).toBe(true);
  return (r.content as { type: string; text: string }[]).map((c) => c.text).join("\n");
}

const said = (r: { guidance: string[] }) => r.guidance.join("\n");

/** The owner as Better Auth knows them, and as an MCP call acts for them. */
async function owner(): Promise<Who> {
  const auth = await rt.auth();
  const person = (await rt.person(new Headers({ cookie: await signedInCookie(auth, OWNER) })))!.id;
  return { actor: `${OWNER} via Claude`, person, clientId: "claude", base: BASE };
}

describe("the server", () => {
  it("names no operator: the instructions describe the product, not whoever runs it", () => {
    expect(MCP_INSTRUCTIONS).toMatch(/view-only/);
    expect(MCP_INSTRUCTIONS).not.toMatch(/bruckner|marcel/i);
  });
});

describe("API tokens", () => {
  it("create_api_token: the token once; hand it over for the password manager once and never repeat it", async () => {
    const me = await owner();
    const made = await tool<{ id: string; token: string; scope: string }>(
      "create_api_token",
      { name: "workshop", scope: "read+write", expiresInDays: null },
      me,
    );
    expect(made.token.startsWith("preview_")).toBe(true);
    expect(said(made)).toMatch(/password manager/);
    expect(said(made)).toMatch(/once/);
    expect(said(made)).toMatch(/never repeat/i);
    expect(said(made)).not.toContain(made.token);
    const list = await tool<{ tokens: { id: string }[] }>("list_api_tokens", {}, me);
    expect(list.tokens.map((t) => t.id)).toEqual([made.id]);
    expect(JSON.stringify(list)).not.toContain(made.token);
    const revoked = await tool<{ revoked: string }>("revoke_api_token", { id: made.id }, me);
    expect(revoked.revoked).toBe(made.id);
    expect(await refusal("revoke_api_token", { id: made.id }, me)).toMatch(/no such token/);
  });

  it("list_api_tokens with none says how to make one", async () => {
    expect(said(await tool("list_api_tokens", {}, await owner()))).toMatch(/create_api_token/);
  });

  it("create_api_token over /mcp with an API token is refused (401): tokens are made by a person or an OAuth client, never by a token", async () => {
    const me = await owner();
    const made = await tool<{ token: string }>("create_api_token", { name: "script", scope: "read+write", expiresInDays: 30 }, me);
    const call = new Request(`${rt.config.publicUrl}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${made.token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "create_api_token", arguments: { name: "x", scope: "read", expiresInDays: 30 } },
      }),
    });
    const r = await mcpRoute(call, ctx);
    expect(r.status).toBe(401);
    expect((await tool<{ tokens: unknown[] }>("list_api_tokens", {}, me)).tokens).toHaveLength(1);
  });

  it("toolsActAsCaller: an MCP call acts for the person it came from: the tokens it makes are theirs", async () => {
    const me = await owner();
    const made = await tool<{ id: string }>("create_api_token", { name: "mine", scope: "read+write", expiresInDays: 30 }, me);
    const other: Who = { ...me, person: "someone-else", actor: "other@example.com via Claude" };
    expect((await tool<{ tokens: unknown[] }>("list_api_tokens", {}, other)).tokens).toEqual([]);
    expect(await refusal("revoke_api_token", { id: made.id }, other)).toBeTruthy();
    expect((await tool<{ tokens: { id: string }[] }>("list_api_tokens", {}, me)).tokens.map((t) => t.id)).toEqual([made.id]);
  });
});

describe("customers", () => {
  it("create_customer returns the link and guides to create_model; the language defaults to German", async () => {
    const me = await owner();
    const c = await tool<{ id: string; language: string; link_url: string; admin_url: string }>("create_customer", { name: "Ada" }, me);
    expect(c.language).toBe("de");
    expect(c.link_url).toMatch(/^https:\/\/preview\.example\.com\/k\/[\w-]{20,}$/);
    expect(c.admin_url).toBe(`${BASE}/customers/${c.id}`);
    expect(said(c)).toMatch(/create_model/);
    expect(said(c)).toContain(c.link_url);
  });

  it("update_customer, get_customer and list_customers", async () => {
    const me = await owner();
    expect(said(await tool("list_customers", {}, me))).toMatch(/create_customer/);
    const c = await tool<{ id: string }>("create_customer", { name: "Ada", language: "en" }, me);
    const u = await tool<{ name: string; language: string }>("update_customer", { id: c.id, name: "Ada L.", language: "de" }, me);
    expect(u).toMatchObject({ name: "Ada L.", language: "de" });
    expect(await tool("get_customer", { id: c.id }, me)).toMatchObject({ id: c.id, name: "Ada L." });
    expect((await tool<{ customers: unknown[] }>("list_customers", {}, me)).customers).toHaveLength(1);
    expect(await refusal("get_customer", { id: "nope" }, me)).toMatch(/No customer/);
    expect(await refusal("update_customer", { id: c.id, name: " " }, me)).toBeTruthy();
  });

  it("renew_link says the old link stopped working; revoke_link then get_customer has no link_url", async () => {
    const me = await owner();
    const c = await tool<{ id: string; link_url: string }>("create_customer", { name: "Ada" }, me);
    const renewed = await tool<{ link_url: string }>("renew_link", { id: c.id }, me);
    expect(renewed.link_url).not.toBe(c.link_url);
    expect(said(renewed)).toMatch(/old link (has )?stopped working/);
    expect(said(renewed)).toContain(renewed.link_url);
    const revoked = await tool<{ link_url: string | null }>("revoke_link", { id: c.id }, me);
    expect(revoked.link_url).toBeNull();
    expect(said(revoked)).toMatch(/renew_link/);
    const got = await tool<{ link_url: string | null }>("get_customer", { id: c.id }, me);
    expect(got.link_url).toBeNull();
    expect(said(got)).toMatch(/renew_link/);
  });
});

describe("models", () => {
  it("create_model carries the model's link and guides to the upload; a revoked customer link gives none", async () => {
    const me = await owner();
    const c = await tool<{ id: string; link_url: string }>("create_customer", { name: "Ada" }, me);
    const m = await tool<{ id: string; link_url: string | null; admin_url: string }>("create_model", { customerId: c.id, title: "Bracket" }, me);
    expect(m.link_url).toBe(`${c.link_url}/${m.id}`);
    expect(m.admin_url).toBe(`${BASE}/models/${m.id}`);
    expect(said(m)).toMatch(new RegExp(`POST /api/models/${m.id}/versions`));
    await tool("revoke_link", { id: c.id }, me);
    expect((await tool<{ link_url: string | null }>("update_model", { id: m.id, title: "Bracket 2" }, me)).link_url).toBeNull();
    expect(await refusal("create_model", { customerId: "nope", title: "x" }, me)).toMatch(/No customer/);
  });

  it("list_models filters by customer; list_versions of a model without versions says to upload one", async () => {
    const me = await owner();
    const a = await tool<{ id: string }>("create_customer", { name: "Ada" }, me);
    const b = await tool<{ id: string }>("create_customer", { name: "Bob" }, me);
    const m = await tool<{ id: string }>("create_model", { customerId: a.id, title: "One" }, me);
    await tool("create_model", { customerId: b.id, title: "Two" }, me);
    expect((await tool<{ models: unknown[] }>("list_models", {}, me)).models).toHaveLength(2);
    const mine = await tool<{ models: { id: string }[] }>("list_models", { customerId: a.id }, me);
    expect(mine.models.map((x) => x.id)).toEqual([m.id]);
    const v = await tool<{ versions: unknown[] }>("list_versions", { modelId: m.id }, me);
    expect(v.versions).toEqual([]);
    expect(said(v)).toMatch(/\/api\/models\/.*\/versions/);
    expect(await refusal("list_versions", { modelId: "nope" }, me)).toMatch(/No model/);
  });
});

describe("versions", () => {
  it("reread_facts reads a version's 3MF again and says what it found", async () => {
    const me = await owner();
    const c = value(createCustomer(rt, { name: "A" }));
    const m = value(createModel(rt, { customerId: c.id, title: "Spulenhalter" }));
    const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });
    const v = value(await addVersion(rt, m.id, { threemf: fixture("plates.3mf"), preview: fixture("preview.png"), drawings: [] }));
    const r = await tool<{ parts: number }>("reread_facts", { version_id: v.id }, me);
    expect(r.parts).toBe(3);
    expect(said(r)).toMatch(/3 parts/);
    expect(await refusal("reread_facts", { version_id: "nope" }, me)).toMatch(/nope/);
  });

  it("list_versions answers each version's print figures and where its slicing stands; reslice_version asks again", async () => {
    rt.store.close();
    rt = testRuntime({ PREVIEW_SLICER_URL: "https://slicing.test" });
    ctx = await mcpContext(rt);
    const me = await owner();
    const c = value(createCustomer(rt, { name: "A" }));
    const m = value(createModel(rt, { customerId: c.id, title: "Spulenhalter" }));
    const fixture = (name: string) => ({ path: join(import.meta.dirname, "fixtures", name) });
    const sliced = value(await addVersion(rt, m.id, { threemf: fixture("plates.3mf"), preview: fixture("preview.png"), drawings: [] }));
    const plain = value(await addVersion(rt, m.id, { threemf: fixture("ramp.3mf"), preview: fixture("preview.png"), drawings: [] }));
    rt.store.putSliceJob(plain.id, "2026-11-28T10:00:00.000Z");
    rt.store.updateSliceJob(plain.id, { state: "failed", reason: "off_plate" });
    const r = await tool<{ versions: { id: string; figures: unknown; slicing: string | null; slicing_error: string | null }[] }>(
      "list_versions",
      { modelId: m.id },
      me,
    );
    expect(r.versions.find((v) => v.id === sliced.id)).toMatchObject({
      figures: { source: "file", seconds: 5400, grams: 29.75 },
      slicing: null,
      slicing_error: null,
    });
    expect(r.versions.find((v) => v.id === plain.id)).toMatchObject({ figures: null, slicing: "failed", slicing_error: "off_plate" });
    const again = await tool<{ slicing: string }>("reslice_version", { version_id: plain.id }, me);
    expect(again.slicing).toBe("pending");
    expect(said(again)).toMatch(/slic/i);
    expect(await refusal("reslice_version", { version_id: sliced.id }, me)).toMatch(/own figures/);
  });
});

describe("filaments", () => {
  it("create_filament, list_filaments, update_filament and delete_filament keep the operator's list", async () => {
    const me = await owner();
    const empty = await tool<{ filaments: unknown[] }>("list_filaments", {}, me);
    expect(empty.filaments).toEqual([]);
    expect(said(empty)).toMatch(/no pickers/i);
    const g = await tool<{ id: string; color: string; available: boolean }>("create_filament", { name: "Bambu Grün", material: "PLA", color: "#00AE42" }, me);
    expect(g).toMatchObject({ color: "#00ae42", available: true });
    await tool("create_filament", { name: "Weiß", material: "PETG", color: "#ffffff", available: false }, me);
    const offered = await tool<{ filaments: { name: string }[] }>("list_filaments", { available: true }, me);
    expect(offered.filaments.map((f) => f.name)).toEqual(["Bambu Grün"]);
    expect(await refusal("create_filament", { name: "Rot", material: "PLA", color: "red" }, me)).toMatch(/#rrggbb/);
    const off = await tool<{ available: boolean }>("update_filament", { id: g.id, available: false }, me);
    expect(off.available).toBe(false);
    expect(said(off)).toMatch(/no longer offered/i);
    expect(await tool<{ id: string }>("delete_filament", { id: g.id }, me)).toMatchObject({ id: g.id });
    expect(await refusal("delete_filament", { id: g.id }, me)).toMatch(/No filament/);
  });
});

function value<T>(o: Outcome<T>): T {
  if (!o.ok) throw new Error(`expected ok, got ${o.reason}: ${o.message}`);
  return o.value;
}
