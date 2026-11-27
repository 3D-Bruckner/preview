// The REST API under /api/v1: next-app-kit/rest's table of operations, the API's one source (the route, openapi.json and its test are
// built from it). Each operation calls the same domain functions as the MCP tool it mirrors (conventions: architecture/mcp-first) and
// names it, or says why none. A domain refusal answers by its reason: not found 404, invalid 400, conflict 409. A read token may only GET
// (the kit refuses the rest with 403).
import { fail, openApiDocument, type OpenApiInfo, type Op } from "next-app-kit/rest";
import { createApiToken, listApiTokens, revokeApiToken, type RestCaller } from "next-app-kit/tokens";
import * as z from "zod";
import { API_TOKEN_PREFIX } from "./accounts";
import type { Runtime } from "./runtime";
import { newTokenSchema, tokenInputSchema, tokenSchema } from "./shapes";

/** The server the committed openapi.json names: a placeholder, since every instance serves its own at <PUBLIC_URL>/api/v1/openapi.json. */
export const EXAMPLE_URL = "https://preview.example.com";

export const OPEN_API: OpenApiInfo = {
  title: "Preview API",
  version: "1",
  description:
    "Customers, their 3D models and the models' versions, shown view-only behind a link per customer. Every operation mirrors an MCP tool of /mcp, named in its description.",
  tags: [{ name: "Tokens", description: "The caller's own API tokens." }],
  bearer: `An API token (\`${API_TOKEN_PREFIX}…\`, made in the web app or with create_api_token; a \`read\` token may only GET), or an OAuth access token from this instance issued for this API (\`resource=<base>/api/v1\`). A token for /mcp is refused here.`,
};

/**
 * Whether the caller came with an API token (the kit's `kind`). An API token may not make or revoke tokens, so a leaked one can't mint
 * more or lock its owner's other tokens out; a person signed in through OAuth (Claude) still may.
 */
const byApiToken = (caller: RestCaller): boolean => caller.kind === "token";
const NO_TOKENS_BY_TOKEN = "An API token can't make or revoke API tokens; use the web app or a client signed in through OAuth.";

export const REST_OPS: Op<Runtime>[] = [
  // Tokens
  {
    method: "GET",
    path: "/tokens",
    operationId: "listApiTokens",
    tool: "list_api_tokens",
    summary: "List the caller's API tokens, newest first (never the tokens themselves)",
    tag: "Tokens",
    ok: { status: 200, description: "The tokens", schema: z.object({ tokens: z.array(tokenSchema) }) },
    errors: [401],
    handle: async ({ ctx, caller }) => ({ status: 200, body: { tokens: await listApiTokens(await ctx.auth(), caller.person) } }),
  },
  {
    method: "POST",
    path: "/tokens",
    operationId: "createApiToken",
    tool: "create_api_token",
    summary: "Make an API token for the caller; the token is in this answer once and never again. Not with an API token (403)",
    tag: "Tokens",
    body: tokenInputSchema,
    ok: { status: 201, description: "The new token", schema: newTokenSchema },
    errors: [400, 401, 403],
    handle: async ({ ctx, caller, body }) => {
      if (byApiToken(caller)) return fail(403, NO_TOKENS_BY_TOKEN);
      const made = await createApiToken(await ctx.auth(), caller.person, body as z.infer<typeof tokenInputSchema>);
      return "error" in made ? fail(400, made.error) : { status: 201, body: made };
    },
  },
  {
    method: "DELETE",
    path: "/tokens/{id}",
    operationId: "revokeApiToken",
    tool: "revoke_api_token",
    summary: "Revoke one of the caller's API tokens. Not with an API token (403)",
    tag: "Tokens",
    params: { id: "The token's id" },
    ok: { status: 204, description: "Revoked" },
    errors: [401, 403, 404],
    handle: async ({ ctx, caller, params }) => {
      if (byApiToken(caller)) return fail(403, NO_TOKENS_BY_TOKEN);
      const r = await revokeApiToken(await ctx.auth(), caller.person, params.id!);
      return r.ok ? { status: 204 } : fail(404, r.error);
    },
  },
];

/** openapi.json as committed: the table's document, its server a placeholder (scripts/generate-openapi.mjs writes it). */
export const openApiFile = (): Record<string, unknown> => openApiDocument(REST_OPS, { ...OPEN_API, serverUrl: `${EXAMPLE_URL}/api/v1` });
