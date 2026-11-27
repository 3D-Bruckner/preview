"use server";
// The web app's server actions: each checks who is asking, calls the domain through @/backend and answers in the page's language
// (proxy.ts's header). A refusal comes back as words for the person, never the domain's English message; the page is re-rendered after
// a change (refresh), so what it shows is what is stored.
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { createApiToken, revokeApiToken } from "next-app-kit/tokens";
import { actionPerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor, LANG_HEADER, type Copy } from "@/components/copy";

export type Result = { ok: true; message?: string; token?: string } | { ok: false; error: string };

async function words(): Promise<Copy> {
  return copyFor((await headers()).get(LANG_HEADER) ?? "");
}

// ---- API tokens (the kit's; the dev user has none)

const EXPIRIES: Record<string, number | null> = { "30": 30, "90": 90, "365": 365, never: null };

export async function addToken(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  const person = await actionPerson();
  if (!person) return { ok: false, error: t.common.signedOut };
  const scope = fd.get("scope") === "read+write" ? "read+write" : "read";
  const expiry = String(fd.get("expiry") ?? "90");
  const expiresInDays = Object.hasOwn(EXPIRIES, expiry) ? EXPIRIES[expiry]! : 90;
  const made = await createApiToken(await runtime().auth(), person.id, { name: String(fd.get("name") ?? "").trim(), scope, expiresInDays });
  if ("error" in made) return { ok: false, error: t.common.failed };
  refresh();
  return { ok: true, token: made.token };
}

export async function revokeToken(id: string): Promise<Result> {
  const t = await words();
  const person = await actionPerson();
  if (!person) return { ok: false, error: t.common.signedOut };
  const out = await revokeApiToken(await runtime().auth(), person.id, id);
  if (!out.ok) return { ok: false, error: t.common.failed };
  refresh();
  return { ok: true, message: t.settings.tokens.revoked };
}
