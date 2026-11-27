// What REST and MCP answer and take alike: customers, models, versions and API tokens. Written once here, so /api/v1 (rest.ts) and /mcp
// (mcp.ts) can't drift apart.
import * as z from "zod";
import { getCustomer, type Customer } from "./customers";
import type { Model } from "./models";
import type { Runtime } from "./runtime";
import type { Version } from "./versions";

/** A new API token's settings. */
export const tokenInputSchema = z.object({
  name: z.string().trim().min(1).max(60).describe("What it is for, e.g. 'workshop upload'."),
  scope: z.enum(["read", "read+write"]).describe("`read` may only GET; `read+write` may change things (an upload needs it)."),
  expiresInDays: z.number().int().min(1).max(365).nullable().describe("Its lifetime in days; null: it never expires (chosen on purpose)."),
});

export const tokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(["read", "read+write"]),
  start: z.string().describe("The token's first characters, to recognise it by."),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
});

export const newTokenSchema = tokenSchema.extend({ token: z.string().describe("The token itself, shown this once.") });

// ---- customers, models, versions

const ID = z.string().min(1);

export const languageSchema = z.enum(["de", "en"]).describe("The language the customer's page opens in.");

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(120).describe("The customer's name, as the workshop knows them."),
  note: z.string().max(2000).optional().describe("A note for the workshop's own use; the customer never sees it."),
  language: languageSchema.optional().describe("The language the customer's page opens in; German when left out."),
});

export const customerPatchSchema = customerInputSchema.partial();

export const customerSchema = z.object({
  id: ID,
  name: z.string(),
  note: z.string().nullable(),
  language: z.enum(["de", "en"]),
  link_url: z.string().nullable().describe("The customer's secret link; null once revoked."),
  admin_url: z.string().describe("The customer's page in the web app, for the person who runs preview."),
  created_at: z.string(),
});

export const modelInputSchema = z.object({
  customerId: ID.describe("The customer the model is for (list_customers)."),
  title: z.string().trim().min(1).max(160).describe("What the customer sees as the model's name."),
  description: z.string().max(4000).optional().describe("A line or two the customer sees under the title."),
});

export const modelPatchSchema = modelInputSchema.omit({ customerId: true }).partial();

export const modelSchema = z.object({
  id: ID,
  customer_id: ID,
  title: z.string(),
  description: z.string().nullable(),
  link_url: z.string().nullable().describe("The link that opens this model for its customer; null when the customer's link is revoked."),
  admin_url: z.string().describe("The model's page in the web app, for the person who runs preview."),
  created_at: z.string(),
  updated_at: z.string(),
});

export const versionSchema = z.object({
  id: ID,
  model_id: ID,
  number: z.number().int(),
  note: z.string().nullable(),
  created_at: z.string(),
  parts: z.number().int().nullable().describe("How many parts its 3MF has; null until its 3MF has been read (reread_facts)."),
  drawings: z.array(z.object({ id: ID, kind: z.enum(["png", "svg", "pdf"]) })),
});

export const factsReadSchema = z.object({ parts: z.number().int().describe("How many parts the version's 3MF has.") });

export const customerJson = (base: string, c: Customer): z.infer<typeof customerSchema> => ({
  id: c.id,
  name: c.name,
  note: c.note,
  language: c.language,
  link_url: c.link ? `${base}/k/${c.link}` : null,
  admin_url: `${base}/customers/${c.id}`,
  created_at: c.createdAt,
});

/** `customer` is the model's customer: its link decides the model's. */
export const modelJson = (base: string, m: Model, customer: Customer): z.infer<typeof modelSchema> => ({
  id: m.id,
  customer_id: m.customerId,
  title: m.title,
  description: m.description,
  link_url: customer.link ? `${base}/k/${customer.link}/${m.id}` : null,
  admin_url: `${base}/models/${m.id}`,
  created_at: m.createdAt,
  updated_at: m.updatedAt,
});

export const versionJson = (v: Version): z.infer<typeof versionSchema> => ({
  id: v.id,
  model_id: v.modelId,
  number: v.number,
  note: v.note,
  created_at: v.createdAt,
  parts: v.parts,
  drawings: v.drawings,
});

/** The model as answered: its customer's link decides its own. */
export function modelOf(rt: Runtime, m: Model): z.infer<typeof modelSchema> {
  const customer = getCustomer(rt, m.customerId);
  if (!customer.ok) throw new Error(`model ${m.id} has no customer ${m.customerId}`);
  return modelJson(rt.config.publicUrl, m, customer.value);
}
