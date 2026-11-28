// What REST and MCP answer and take alike: customers, models, versions, filaments and API tokens. Written once here, so /api/v1 (rest.ts) and /mcp
// (mcp.ts) can't drift apart.
import * as z from "zod";
import { getCustomer, type Customer } from "./customers";
import { FILAMENT_MATERIAL_MAX, FILAMENT_NAME_MAX, type Filament } from "./filaments";
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

export const figuresSchema = z.object({
  source: z.enum(["file", "slicer"]).describe("file: Bambu Studio's own slice in the 3MF; slicer: the slicing service's, on its fixed profiles."),
  seconds: z.number().int().describe("Print time in seconds."),
  grams: z.number().describe("Weight in grams, the whole model."),
  filaments: z.array(z.object({ slot: z.number().int(), type: z.string().nullable(), color: z.string().nullable().describe("#rrggbb"), grams: z.number() })),
});

export const versionSchema = z.object({
  id: ID,
  model_id: ID,
  number: z.number().int(),
  note: z.string().nullable(),
  created_at: z.string(),
  parts: z.number().int().nullable().describe("How many parts its 3MF has; null until its 3MF has been read (reread_facts)."),
  drawings: z.array(z.object({ id: ID, kind: z.enum(["png", "svg", "pdf"]) })),
  figures: figuresSchema.nullable().describe("What printing the whole model takes; null while there are none (see slicing)."),
  slicing: z
    .enum(["pending", "failed"])
    .nullable()
    .describe("pending: the slicing service will answer for a 3MF without figures of its own; failed: it couldn't (slicing_error); null otherwise."),
  slicing_error: z.string().nullable().describe("Why the slicing failed (the service's reason, such as off_plate or too_large)."),
});

export const sliceSchema = z.object({ slicing: z.literal("pending") });

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
  figures: v.figures,
  slicing: v.slicing,
  slicing_error: v.reason,
});

/** The model as answered: its customer's link decides its own. */
export function modelOf(rt: Runtime, m: Model): z.infer<typeof modelSchema> {
  const customer = getCustomer(rt, m.customerId);
  if (!customer.ok) throw new Error(`model ${m.id} has no customer ${m.customerId}`);
  return modelJson(rt.config.publicUrl, m, customer.value);
}

// ---- Filaments

export const filamentInputSchema = z.object({
  name: z.string().trim().min(1).max(FILAMENT_NAME_MAX).describe('What the customer sees in the picker, e.g. "Bambu Grün".'),
  material: z
    .string()
    .trim()
    .min(1)
    .max(FILAMENT_MATERIAL_MAX)
    .describe("As the slicer writes it, e.g. PLA or PETG; with the colour it names a file's filament."),
  color: z.string().describe("#rrggbb, e.g. #00ae42."),
  available: z.boolean().optional().describe("Whether the customer can pick it (default true); false keeps it without offering it."),
});

export const filamentPatchSchema = filamentInputSchema.partial().extend({
  position: z.number().int().min(1).optional().describe("Its place in the picker, from 1; equal places keep the order they were made in."),
});

export const filamentSchema = z.object({
  id: ID,
  name: z.string(),
  material: z.string(),
  color: z.string(),
  available: z.boolean(),
  position: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const filamentJson = (f: Filament): z.infer<typeof filamentSchema> => ({
  id: f.id,
  name: f.name,
  material: f.material,
  color: f.color,
  available: f.available,
  position: f.position,
  created_at: f.createdAt,
  updated_at: f.updatedAt,
});
