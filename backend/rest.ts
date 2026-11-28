// The REST API under /api/v1: next-app-kit/rest's table of operations, the API's one source (the route, openapi.json and its test are
// built from it). Each operation calls the same domain functions as the MCP tool it mirrors (conventions: architecture/mcp-first) and
// names it, or says why none. A domain refusal answers by its reason: not found 404, invalid 400, conflict 409. A read token may only GET
// (the kit refuses the rest with 403).
import { fail, openApiDocument, type OpenApiInfo, type Op, type Reply } from "next-app-kit/rest";
import { createApiToken, listApiTokens, revokeApiToken, type RestCaller } from "next-app-kit/tokens";
import * as z from "zod";
import { API_TOKEN_PREFIX } from "./accounts";
import { createCustomer, getCustomer, listCustomers, renewLink, revokeLink, updateCustomer, type Customer, type Language } from "./customers";
import { rereadFacts } from "./facts";
import { createModel, listModels, updateModel } from "./models";
import type { Outcome, Reason } from "./outcome";
import type { Runtime } from "./runtime";
import {
  customerInputSchema,
  customerJson,
  customerPatchSchema,
  customerSchema,
  factsReadSchema,
  sliceSchema,
  modelInputSchema,
  modelOf,
  modelPatchSchema,
  modelSchema,
  newTokenSchema,
  tokenInputSchema,
  tokenSchema,
  versionJson,
  versionSchema,
} from "./shapes";
import { listVersions } from "./versions";
import { resliceVersion } from "./figures";

/** The server the committed openapi.json names: a placeholder, since every instance serves its own at <PUBLIC_URL>/api/v1/openapi.json. */
export const EXAMPLE_URL = "https://preview.example.com";

export const OPEN_API: OpenApiInfo = {
  title: "Preview API",
  version: "1",
  description:
    "Customers, their 3D models and the models' versions, shown view-only behind a link per customer. Every operation mirrors an MCP tool of /mcp, named in its description.",
  tags: [
    { name: "Customers", description: "Who the models are for, and the link each opens their page by." },
    { name: "Models", description: "What a customer is shown, and its versions." },
    { name: "Tokens", description: "The caller's own API tokens." },
  ],
  bearer: `An API token (\`${API_TOKEN_PREFIX}…\`, made in the web app or with create_api_token; a \`read\` token may only GET), or an OAuth access token from this instance issued for this API (\`resource=<base>/api/v1\`). A token for /mcp is refused here.`,
};

const STATUS: Record<Reason, number> = { not_found: 404, invalid: 400, conflict: 409 };

/** A domain outcome as a reply: `status` with `body(value)`, or the refusal's status and message. */
function answer<T>(o: Outcome<T>, status: number, body: (v: T) => unknown): Reply {
  return o.ok ? { status, body: body(o.value) } : fail(STATUS[o.reason], o.message);
}

const customerBody = (ctx: Runtime) => (c: Customer) => customerJson(ctx.config.publicUrl, c);

const CUSTOMER_ID = { id: "The customer's id" };
const MODEL_ID = { id: "The model's id" };

/**
 * Whether the caller came with an API token (the kit's `kind`). An API token may not make or revoke tokens, so a leaked one can't mint
 * more or lock its owner's other tokens out; a person signed in through OAuth (Claude) still may.
 */
const byApiToken = (caller: RestCaller): boolean => caller.kind === "token";
const NO_TOKENS_BY_TOKEN = "An API token can't make or revoke API tokens; use the web app or a client signed in through OAuth.";

export const REST_OPS: Op<Runtime>[] = [
  // Customers
  {
    method: "GET",
    path: "/customers",
    operationId: "listCustomers",
    tool: "list_customers",
    summary: "List the customers by name, each with their link",
    tag: "Customers",
    ok: { status: 200, description: "The customers", schema: z.object({ customers: z.array(customerSchema) }) },
    errors: [401],
    handle: ({ ctx }) => ({ status: 200, body: { customers: listCustomers(ctx).map((c) => customerJson(ctx.config.publicUrl, c)) } }),
  },
  {
    method: "POST",
    path: "/customers",
    operationId: "createCustomer",
    tool: "create_customer",
    summary: "Add a customer and make their link",
    tag: "Customers",
    body: customerInputSchema,
    ok: { status: 201, description: "The new customer", schema: customerSchema },
    errors: [400, 401, 403],
    handle: ({ ctx, body }) => answer(createCustomer(ctx, body as { name: string; note?: string; language?: Language }), 201, customerBody(ctx)),
  },
  {
    method: "GET",
    path: "/customers/{id}",
    operationId: "getCustomer",
    tool: "get_customer",
    summary: "One customer with their link (null when revoked)",
    tag: "Customers",
    params: CUSTOMER_ID,
    ok: { status: 200, description: "The customer", schema: customerSchema },
    errors: [401, 404],
    handle: ({ ctx, params }) => answer(getCustomer(ctx, params.id!), 200, customerBody(ctx)),
  },
  {
    method: "PATCH",
    path: "/customers/{id}",
    operationId: "updateCustomer",
    tool: "update_customer",
    summary: "Change a customer's name, note or language; only what is given changes",
    tag: "Customers",
    params: CUSTOMER_ID,
    body: customerPatchSchema,
    ok: { status: 200, description: "The customer", schema: customerSchema },
    errors: [400, 401, 403, 404],
    handle: ({ ctx, params, body }) =>
      answer(updateCustomer(ctx, params.id!, body as { name?: string; note?: string; language?: Language }), 200, customerBody(ctx)),
  },
  {
    method: "POST",
    path: "/customers/{id}/link",
    operationId: "renewLink",
    tool: "renew_link",
    summary: "Give the customer a new link; the old one stops working",
    tag: "Customers",
    params: CUSTOMER_ID,
    ok: { status: 200, description: "The customer with the new link", schema: customerSchema },
    errors: [401, 403, 404],
    handle: ({ ctx, params }) => answer(renewLink(ctx, params.id!), 200, customerBody(ctx)),
  },
  {
    method: "DELETE",
    path: "/customers/{id}/link",
    operationId: "revokeLink",
    tool: "revoke_link",
    summary: "Take the customer's link away; nothing opens their page until it is renewed",
    tag: "Customers",
    params: CUSTOMER_ID,
    ok: { status: 200, description: "The customer without a link", schema: customerSchema },
    errors: [401, 403, 404],
    handle: ({ ctx, params }) => answer(revokeLink(ctx, params.id!), 200, customerBody(ctx)),
  },
  // Models
  {
    method: "GET",
    path: "/models",
    operationId: "listModels",
    tool: "list_models",
    summary: "List models, newest first, all or one customer's (?customer=<id>)",
    tag: "Models",
    query: z.object({ customer: z.string().min(1).optional().describe("Only this customer's models.") }),
    ok: { status: 200, description: "The models", schema: z.object({ models: z.array(modelSchema) }) },
    errors: [401],
    handle: ({ ctx, query }) => ({
      status: 200,
      body: { models: listModels(ctx, { customerId: query.customer as string | undefined }).map((m) => modelOf(ctx, m)) },
    }),
  },
  {
    method: "POST",
    path: "/models",
    operationId: "createModel",
    tool: "create_model",
    summary: "Add a model for a customer",
    tag: "Models",
    body: modelInputSchema,
    ok: { status: 201, description: "The new model", schema: modelSchema },
    errors: [400, 401, 403, 404],
    handle: ({ ctx, body }) => answer(createModel(ctx, body as { customerId: string; title: string; description?: string }), 201, (m) => modelOf(ctx, m)),
  },
  {
    method: "PATCH",
    path: "/models/{id}",
    operationId: "updateModel",
    tool: "update_model",
    summary: "Change a model's title or description; only what is given changes",
    tag: "Models",
    params: MODEL_ID,
    body: modelPatchSchema,
    ok: { status: 200, description: "The model", schema: modelSchema },
    errors: [400, 401, 403, 404],
    handle: ({ ctx, params, body }) => answer(updateModel(ctx, params.id!, body as { title?: string; description?: string }), 200, (m) => modelOf(ctx, m)),
  },
  {
    method: "GET",
    path: "/models/{id}/versions",
    operationId: "listVersions",
    tool: "list_versions",
    summary: "A model's versions, newest first. A version is uploaded with POST /api/models/{id}/versions (multipart; not part of this API)",
    tag: "Models",
    params: MODEL_ID,
    ok: { status: 200, description: "The versions", schema: z.object({ versions: z.array(versionSchema) }) },
    errors: [401, 404],
    handle: ({ ctx, params }) => answer(listVersions(ctx, params.id!), 200, (v) => ({ versions: v.map(versionJson) })),
  },
  {
    method: "POST",
    path: "/versions/{id}/facts",
    operationId: "rereadFacts",
    tool: "reread_facts",
    summary: "Read the version's 3MF again for its parts and filament colours",
    tag: "Models",
    params: { id: "The version's id" },
    ok: { status: 200, description: "What was read", schema: factsReadSchema },
    errors: [400, 401, 403, 404],
    handle: ({ ctx, params }) => answer(rereadFacts(ctx, params.id!), 200, (v) => v),
  },
  {
    method: "POST",
    path: "/versions/{id}/slice",
    operationId: "resliceVersion",
    tool: "reslice_version",
    summary: "Ask the slicing service again for the version's print figures",
    tag: "Models",
    params: { id: "The version's id" },
    ok: { status: 200, description: "Back in line for the slicer", schema: sliceSchema },
    errors: [400, 401, 403, 404],
    handle: ({ ctx, params }) => answer(resliceVersion(ctx, params.id!), 200, (v) => v),
  },
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
