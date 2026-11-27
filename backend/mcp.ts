// The MCP tools at /mcp (conventions: architecture/mcp-first): the kit's defineTool over the same domain functions REST calls, each tool
// mirrored by the REST operation that names it (rest.ts; checkOpsMirrorTools in rest.test.ts). What Claude needs before a call is in the
// descriptions; what only matters after it is in each result's `guidance`, built from what the call did, and written only here (REST
// stays plain data). The shapes are shared with REST (shapes.ts). A domain refusal is the kit's `refuse`, its message the domain's
// English one.
import { defineTool, refuse, type McpContext, type Tool } from "next-app-kit/mcp";
import { createApiToken, listApiTokens, revokeApiToken } from "next-app-kit/tokens";
import * as z from "zod";
import type { Runtime } from "./runtime";
import { newTokenSchema, tokenInputSchema, tokenSchema } from "./shapes";

/** The server's own text: what a client may drop, so nothing here is needed after a call (that is each result's guidance). */
export const MCP_INSTRUCTIONS = [
  "Preview keeps 3D models (3MF files, in numbered versions) for customers and shows them view-only behind a secret link per customer.",
  "Whoever runs it signs in here; customers never do, they only open their link.",
].join(" ");

const SERVER_INFO = { name: "preview", version: "1" };

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DELETE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

/** The tools over `rt`, each acting for the caller the kit found (who). */
export function mcpTools(rt: Runtime): Tool[] {
  return [
    // Tokens
    defineTool({
      name: "create_api_token",
      description:
        "Make an API token for scripts (a workshop's upload uses a `read+write` one). The token is in this result once and never again. Ask the person for its name, scope and lifetime first.",
      input: tokenInputSchema,
      output: newTokenSchema,
      annotations: WRITE,
      handle: async (input, who) => {
        const made = await createApiToken(await rt.auth(), who.person, input);
        if ("error" in made) return refuse(made.error);
        return {
          ...made,
          guidance: [
            "Hand the token to the person once, to keep in their password manager; never repeat it afterwards, and don't put it anywhere else (no files, no notes).",
            `list_api_tokens shows it by its start, "${made.start}"; revoke_api_token takes it back.`,
          ],
        };
      },
    }),
    defineTool({
      name: "list_api_tokens",
      description: "List the caller's API tokens, newest first: names, scopes, starts and dates, never the tokens themselves.",
      input: z.object({}),
      output: z.object({ tokens: z.array(tokenSchema) }),
      annotations: READ,
      handle: async (_, who) => {
        const tokens = await listApiTokens(await rt.auth(), who.person);
        return {
          tokens,
          guidance: [
            tokens.length === 0 ? "No API tokens; create_api_token makes one." : "A token can't be shown again; revoke_api_token takes one back by its id.",
          ],
        };
      },
    }),
    defineTool({
      name: "revoke_api_token",
      description: "Revoke one of the caller's API tokens by its id (list_api_tokens); scripts using it are refused from then on.",
      input: z.object({ id: z.string().min(1).describe("The token's id.") }),
      output: z.object({ revoked: z.string().describe("The revoked token's id.") }),
      annotations: DELETE,
      handle: async ({ id }, who) => {
        const r = await revokeApiToken(await rt.auth(), who.person, id);
        if (!r.ok) return refuse(r.error);
        return { revoked: id, guidance: ["Revoked: whatever used it now gets 401. If a script still needs access, it needs a new token."] };
      },
    }),
  ];
}

// One context per runtime: the kit keeps one MCP handler per context object, and the route asks for it once.
const contexts = new WeakMap<Runtime, Promise<McpContext>>();

/** /mcp's context for `rt`: its sign-in, the tools, the server's instructions and the log a tool that throws is logged to. */
export function mcpContext(rt: Runtime): Promise<McpContext> {
  let ctx = contexts.get(rt);
  if (!ctx) {
    ctx = (async () => ({
      auth: await rt.auth(),
      signIn: rt.signIn,
      tools: mcpTools(rt),
      serverInfo: SERVER_INFO,
      instructions: MCP_INSTRUCTIONS,
      log: (line: string) => rt.log.error(line),
    }))();
    contexts.set(rt, ctx);
    ctx.catch(() => contexts.delete(rt));
  }
  return ctx;
}
