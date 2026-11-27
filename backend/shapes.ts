// What REST and MCP answer and take alike: an API token and a new token's settings. Written once here, so /api/v1 (rest.ts) and /mcp
// (mcp.ts) can't drift apart.
import * as z from "zod";

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
