// The MCP tools (backend/mcp.ts) through the kit's MCP server, as /mcp serves them (callTool: schemas and all, without a token): each
// tool's result with its guidance, and the tools acting for their caller.
import { mcpRoute, type McpContext, type Who } from "next-app-kit/mcp";
import { callTool, signedInCookie } from "next-app-kit/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MCP_INSTRUCTIONS, mcpContext } from "./mcp";
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
