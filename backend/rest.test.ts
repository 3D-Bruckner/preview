// The REST API (backend/rest.ts) through the kit's restRoute, as /api/v1 serves it: the caller's own API tokens, the operations
// mirroring the MCP tools, and openapi.json as committed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkOpsMirrorTools, openApiDocument, restRoute } from "next-app-kit/rest";
import { signedInCookie } from "next-app-kit/testing";
import { createApiToken, type RestCaller } from "next-app-kit/tokens";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mcpContext } from "./mcp";
import { OPEN_API, openApiFile, REST_OPS } from "./rest";
import { OWNER, testRuntime, type TestRuntime } from "./testing/runtime";

let rt: TestRuntime;
beforeEach(() => {
  rt = testRuntime();
});
afterEach(() => rt.store.close());

const BASE = "https://preview.example.com";

function request(method: string, path: string, opts: { body?: unknown; token?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${BASE}/api/v1${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

/** A request as /api/v1 answers it, the caller found from its token as in production. */
async function withToken(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  const req = request(method, path, { token, body });
  return restRoute(req, REST_OPS, rt, await rt.apiCaller(req), { base: BASE, log: () => {} });
}

/** A request from a given caller (who they are is restCaller's, tested in accounts.test.ts). */
const call = (method: string, path: string, body: unknown, caller: RestCaller) =>
  restRoute(request(method, path, { body }), REST_OPS, rt, caller, { base: BASE, log: () => {} });

async function json<T = Record<string, unknown>>(r: Response): Promise<T> {
  return (await r.json()) as T;
}

/** The owner's person id, as Better Auth knows them. */
async function owner(): Promise<string> {
  const auth = await rt.auth();
  return (await rt.person(new Headers({ cookie: await signedInCookie(auth, OWNER) })))!.id;
}

describe("API tokens", () => {
  it("makes, lists and revokes the caller's own API tokens (signed in through OAuth)", async () => {
    const me: RestCaller = { person: await owner(), actor: `${OWNER} via Claude`, scope: "read+write", kind: "oauth" };
    const made = await call("POST", "/tokens", { name: "workshop", scope: "read+write", expiresInDays: null }, me);
    expect(made.status).toBe(201);
    const t = await json<{ id: string; token: string; scope: string; expires_at: string | null }>(made);
    expect(t).toMatchObject({ scope: "read+write", expires_at: null });
    expect(t.token.startsWith("preview_")).toBe(true);
    const list = await json<{ tokens: { id: string }[] }>(await call("GET", "/tokens", undefined, me));
    expect(list.tokens.map((x) => x.id)).toEqual([t.id]);
    expect(JSON.stringify(list)).not.toContain(t.token);
    expect((await call("DELETE", `/tokens/${t.id}`, undefined, me)).status).toBe(204);
    expect((await call("DELETE", `/tokens/${t.id}`, undefined, me)).status).toBe(404);
  });

  it("tokenManagementRefusesApiTokens: an API token may list tokens but neither make nor revoke one (403 forbidden)", async () => {
    const person = await owner();
    const auth = await rt.auth();
    const kept = await createApiToken(auth, person, { name: "reader", scope: "read", expiresInDays: null });
    if ("error" in kept) throw new Error(kept.error);
    const writer = await createApiToken(auth, person, { name: "workshop", scope: "read+write", expiresInDays: null });
    if ("error" in writer) throw new Error(writer.error);
    const made = await withToken("POST", "/tokens", writer.token, { name: "more", scope: "read+write", expiresInDays: null });
    expect(made.status).toBe(403);
    expect(await json(made)).toMatchObject({ code: "forbidden" });
    const revoked = await withToken("DELETE", `/tokens/${kept.id}`, writer.token);
    expect(revoked.status).toBe(403);
    expect((await withToken("GET", "/tokens", writer.token)).status).toBe(200);
    expect((await withToken("GET", "/tokens")).status).toBe(401);
  });

  it("tokenManagementGoesByKind: the caller's kind decides, never what its actor says", async () => {
    const person = await owner();
    const body = { name: "x", scope: "read", expiresInDays: 30 };
    expect((await call("POST", "/tokens", body, { person, actor: `${OWNER} via Claude`, scope: "read+write", kind: "token" })).status).toBe(403);
    expect((await call("POST", "/tokens", body, { person, actor: OWNER, scope: "read+write", kind: "oauth" })).status).toBe(201);
  });
});

describe("the table", () => {
  it("openapiIsCurrent: the committed openapi.json is the table's document (npm run generate writes it)", () => {
    const committed = JSON.parse(readFileSync(join(import.meta.dirname, "..", "openapi.json"), "utf8")) as unknown;
    expect(committed).toEqual(openApiFile());
    expect(openApiFile()).toEqual(openApiDocument(REST_OPS, { ...OPEN_API, serverUrl: "https://preview.example.com/api/v1" }));
  });

  it("names the MCP tool each operation mirrors, or why none", () => {
    expect(REST_OPS.every((o) => (o.tool === undefined) !== (o.noTool === undefined))).toBe(true);
  });

  it("everyToolHasAnOperation: every MCP tool has the operation that mirrors it, and every operation's tool exists", async () => {
    const tools = (await mcpContext(rt)).tools;
    expect(() => checkOpsMirrorTools(REST_OPS, tools)).not.toThrow();
    expect(() => checkOpsMirrorTools(REST_OPS, [...tools, { name: "a_tool_without_an_operation" }])).toThrow();
  });
});
