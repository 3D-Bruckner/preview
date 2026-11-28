"use server";
// The web app's server actions: each checks who is asking, calls the domain through @/backend and answers in the page's language
// (proxy.ts's header). A refusal comes back as words for the person, never the domain's English message; the page is re-rendered after
// a change (refresh), so what it shows is what is stored.
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createApiToken, revokeApiToken } from "next-app-kit/tokens";
import {
  createCustomer,
  createFilament,
  createModel,
  deleteFilament,
  renewLink,
  resliceVersion,
  updateFilament,
  revokeLink,
  updateCustomer,
  updateModel,
  type Language,
  type Outcome,
} from "@/backend";
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

// ---- customers, their links, models (the domain does the work; these only check who asks and put a refusal into words)

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");
const languageField = (fd: FormData): Language => (fd.get("language") === "en" ? "en" : "de");

/** A refusal in words: the domain's English message is never shown. */
function refused<T>(t: Copy, out: Extract<Outcome<T>, { ok: false }>, invalidText: string): Result {
  return { ok: false, error: out.reason === "not_found" ? t.admin.refused.notFound : out.reason === "invalid" ? invalidText : t.admin.refused.other };
}

export async function addCustomer(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = createCustomer(runtime(), { name: field(fd, "name"), note: field(fd, "note"), language: languageField(fd) });
  if (!out.ok) return refused(t, out, t.admin.refused.name);
  redirect(`/customers/${out.value.id}`);
}

export async function saveCustomer(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = updateCustomer(runtime(), field(fd, "id"), { name: field(fd, "name"), note: field(fd, "note"), language: languageField(fd) });
  if (!out.ok) return refused(t, out, t.admin.refused.name);
  refresh();
  return { ok: true, message: t.admin.customer.saved };
}

export async function renewCustomerLink(id: string): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = renewLink(runtime(), id);
  if (!out.ok) return refused(t, out, t.admin.refused.other);
  refresh();
  return { ok: true, message: t.admin.customer.renewed };
}

export async function revokeCustomerLink(id: string): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = revokeLink(runtime(), id);
  if (!out.ok) return refused(t, out, t.admin.refused.other);
  refresh();
  return { ok: true, message: t.admin.customer.revoked };
}

export async function addModel(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = createModel(runtime(), { customerId: field(fd, "customerId"), title: field(fd, "title"), description: field(fd, "description") });
  if (!out.ok) return refused(t, out, t.admin.refused.title);
  redirect(`/models/${out.value.id}`);
}

export async function saveModel(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = updateModel(runtime(), field(fd, "id"), { title: field(fd, "title"), description: field(fd, "description") });
  if (!out.ok) return refused(t, out, t.admin.refused.title);
  refresh();
  return { ok: true, message: t.admin.customer.saved };
}

export async function reslice(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = resliceVersion(runtime(), field(fd, "versionId"));
  if (!out.ok) return refused(t, out, t.admin.refused.other);
  refresh();
  return { ok: true, message: t.admin.model.figures.resliced };
}

// ---- filaments (settings)

const filamentFields = (fd: FormData) => ({
  name: field(fd, "name"),
  material: field(fd, "material"),
  color: field(fd, "color"),
  available: fd.get("available") === "on",
});

export async function addFilament(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = createFilament(runtime(), filamentFields(fd));
  if (!out.ok) return refused(t, out, t.settings.filaments.invalid);
  refresh();
  return { ok: true, message: t.settings.filaments.added };
}

export async function saveFilament(_prev: Result | null, fd: FormData): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const position = Number(field(fd, "position"));
  const out = updateFilament(runtime(), field(fd, "id"), { ...filamentFields(fd), ...(position ? { position } : {}) });
  if (!out.ok) return refused(t, out, t.settings.filaments.invalid);
  refresh();
  return { ok: true, message: t.settings.filaments.saved };
}

export async function removeFilament(id: string): Promise<Result> {
  const t = await words();
  if (!(await actionPerson())) return { ok: false, error: t.common.signedOut };
  const out = deleteFilament(runtime(), id);
  if (!out.ok) return refused(t, out, t.admin.refused.other);
  refresh();
  return { ok: true, message: t.settings.filaments.removed };
}
