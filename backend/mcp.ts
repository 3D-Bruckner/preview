// The MCP tools at /mcp (conventions: architecture/mcp-first): the kit's defineTool over the same domain functions REST calls, each tool
// mirrored by the REST operation that names it (rest.ts; checkOpsMirrorTools in rest.test.ts). What Claude needs before a call is in the
// descriptions; what only matters after it is in each result's `guidance`, built from what the call did, and written only here (REST
// stays plain data). The shapes are shared with REST (shapes.ts). A domain refusal is the kit's `refuse`, its message the domain's
// English one.
import { defineTool, refuse, type McpContext, type Tool } from "next-app-kit/mcp";
import { createApiToken, listApiTokens, revokeApiToken } from "next-app-kit/tokens";
import * as z from "zod";
import { createCustomer, getCustomer, listCustomers, renewLink, revokeLink, updateCustomer, type Customer } from "./customers";
import { rereadFacts } from "./facts";
import { createModel, listModels, updateModel } from "./models";
import type { Outcome } from "./outcome";
import type { Runtime } from "./runtime";
import {
  customerInputSchema,
  customerJson,
  customerPatchSchema,
  customerSchema,
  factsReadSchema,
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

/** A domain refusal as the tool's refusal. */
const refused = (o: Extract<Outcome<unknown>, { ok: false }>) => refuse(o.message);

/** What a customer's link is now, as one line. */
const customerLinkGuidance = (c: Customer): string[] => [
  c.link
    ? "Their link is in link_url; renew_link replaces it (the old one stops working), revoke_link takes it away."
    : "Their link is revoked, so nobody can open their page; renew_link makes a new one.",
];

const UPLOAD = (modelId: string) =>
  `Versions are uploaded from the workshop with POST /api/models/${modelId}/versions (multipart, an API token with read+write), not over MCP; each is visible on the customer's link at once.`;

/** The server's own text: what a client may drop, so nothing here is needed after a call (that is each result's guidance). */
export const MCP_INSTRUCTIONS = [
  "Preview keeps 3D models (3MF files, in numbered versions) for customers and shows them view-only behind a secret link per customer.",
  "Whoever runs it signs in here; customers never do, they only open their link.",
  "Versions are uploaded with the REST multipart route (POST /api/models/{id}/versions) from the workshop, not over MCP; every version is visible on the customer's link at once.",
].join(" ");

const SERVER_INFO = { name: "preview", version: "1" };

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DELETE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

/** The tools over `rt`, each acting for the caller the kit found (who). */
export function mcpTools(rt: Runtime): Tool[] {
  const base = rt.config.publicUrl;
  return [
    // Customers
    defineTool({
      name: "list_customers",
      description: "List the customers by name, each with the link their page opens by (null when revoked).",
      input: z.object({}),
      output: z.object({ customers: z.array(customerSchema) }),
      annotations: READ,
      handle: async () => {
        const customers = listCustomers(rt).map((c) => customerJson(base, c));
        return {
          customers,
          guidance: [
            customers.length === 0
              ? "No customers yet; create_customer makes one and its link."
              : "get_customer shows one; list_models with a customerId shows their models.",
          ],
        };
      },
    }),
    defineTool({
      name: "create_customer",
      description:
        "Add a customer and make the secret link they open their page by. Ask for their name and the language their page should open in (German unless told otherwise).",
      input: customerInputSchema,
      output: customerSchema,
      annotations: WRITE,
      handle: async (input) => {
        const c = createCustomer(rt, input);
        if (!c.ok) return refused(c);
        const json = customerJson(base, c.value);
        return {
          ...json,
          guidance: [
            `Their link is ${json.link_url}: send it to them; it shows whatever models they have, view-only, and nothing yet.`,
            `create_model with customerId ${json.id} adds their first model.`,
          ],
        };
      },
    }),
    defineTool({
      name: "update_customer",
      description: "Change a customer's name, note or language; only what is given changes (an empty note clears it). The link stays the same.",
      input: customerPatchSchema.extend({ id: z.string().min(1).describe("The customer's id (list_customers).") }),
      output: customerSchema,
      annotations: WRITE,
      handle: async ({ id, ...patch }) => {
        const c = updateCustomer(rt, id, patch);
        if (!c.ok) return refused(c);
        return { ...customerJson(base, c.value), guidance: ["Changed. The customer's link is the same as before."] };
      },
    }),
    defineTool({
      name: "get_customer",
      description: "One customer with their link (null when revoked).",
      input: z.object({ id: z.string().min(1).describe("The customer's id (list_customers).") }),
      output: customerSchema,
      annotations: READ,
      handle: async ({ id }) => {
        const c = getCustomer(rt, id);
        if (!c.ok) return refused(c);
        return { ...customerJson(base, c.value), guidance: customerLinkGuidance(c.value) };
      },
    }),
    defineTool({
      name: "renew_link",
      description: "Give a customer a new link; the old one stops working at once. Use it when a link got out, or after revoke_link.",
      input: z.object({ id: z.string().min(1).describe("The customer's id.") }),
      output: customerSchema,
      annotations: WRITE,
      handle: async ({ id }) => {
        const c = renewLink(rt, id);
        if (!c.ok) return refused(c);
        const json = customerJson(base, c.value);
        return { ...json, guidance: [`The old link stopped working. The new one is ${json.link_url}; send it to the customer.`] };
      },
    }),
    defineTool({
      name: "revoke_link",
      description: "Take a customer's link away: nothing opens their page until renew_link makes a new one.",
      input: z.object({ id: z.string().min(1).describe("The customer's id.") }),
      output: customerSchema,
      annotations: DELETE,
      handle: async ({ id }) => {
        const c = revokeLink(rt, id);
        if (!c.ok) return refused(c);
        return { ...customerJson(base, c.value), guidance: ["The link no longer opens anything and the customer sees no models; renew_link makes a new one."] };
      },
    }),
    // Models
    defineTool({
      name: "list_models",
      description: "List models, newest first, all of them or one customer's; each with the link that opens it for its customer.",
      input: z.object({ customerId: z.string().min(1).optional().describe("Only this customer's models (list_customers).") }),
      output: z.object({ models: z.array(modelSchema) }),
      annotations: READ,
      handle: async ({ customerId }) => {
        const models = listModels(rt, { customerId }).map((m) => modelOf(rt, m));
        return {
          models,
          guidance: [models.length === 0 ? "No models; create_model adds one for a customer." : "list_versions shows a model's versions."],
        };
      },
    }),
    defineTool({
      name: "create_model",
      description:
        "Add a model for a customer (list_customers). Ask for its title and, if wanted, a line of description. It has no versions until one is uploaded.",
      input: modelInputSchema,
      output: modelSchema,
      annotations: WRITE,
      handle: async (input) => {
        const m = createModel(rt, input);
        if (!m.ok) return refused(m);
        const json = modelOf(rt, m.value);
        return {
          ...json,
          guidance: [
            UPLOAD(json.id),
            json.link_url
              ? `Its link is ${json.link_url}; it shows nothing until a version is uploaded.`
              : "The customer's link is revoked, so nobody can open it; renew_link makes a new one.",
          ],
        };
      },
    }),
    defineTool({
      name: "update_model",
      description: "Change a model's title or description; only what is given changes (an empty description clears it).",
      input: modelPatchSchema.extend({ id: z.string().min(1).describe("The model's id (list_models).") }),
      output: modelSchema,
      annotations: WRITE,
      handle: async ({ id, ...patch }) => {
        const m = updateModel(rt, id, patch);
        if (!m.ok) return refused(m);
        return { ...modelOf(rt, m.value), guidance: ["Changed; the customer sees it on their next visit."] };
      },
    }),
    defineTool({
      name: "list_versions",
      description: "A model's versions, newest first, each with its number, note and drawings.",
      input: z.object({ modelId: z.string().min(1).describe("The model's id (list_models).") }),
      output: z.object({ versions: z.array(versionSchema) }),
      annotations: READ,
      handle: async ({ modelId }) => {
        const v = listVersions(rt, modelId);
        if (!v.ok) return refused(v);
        return {
          versions: v.value.map(versionJson),
          guidance: [v.value.length === 0 ? `No versions yet. ${UPLOAD(modelId)}` : `The customer sees all ${v.value.length} on their link, the newest first.`],
        };
      },
    }),
    defineTool({
      name: "reread_facts",
      description:
        "Read a version's 3MF again for its parts and filament colours (done at upload and at start; needed only after preview's 3MF reader changed, or when a customer's page lists the parts wrongly).",
      input: z.object({ version_id: z.string().min(1).describe("The version's id (list_versions).") }),
      output: factsReadSchema,
      annotations: WRITE,
      handle: async ({ version_id }) => {
        const r = rereadFacts(rt, version_id);
        if (!r.ok) return refused(r);
        return { ...r.value, guidance: [`The version has ${r.value.parts} parts now; the customer's page lists them on its next load.`] };
      },
    }),
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
