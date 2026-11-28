// Customers: who the models are for. Each has a link token they open their page by; the token is the customer's only credential, so
// customerByToken is the one gate every customer-facing read goes through. Renewing replaces the token, revoking deletes it.
import { randomBytes, randomUUID } from "node:crypto";
import { invalid, notFound, ok, type Outcome } from "./outcome";
import { mutation, type Runtime } from "./runtime";

export type Language = "de" | "en";
export type Customer = {
  id: string;
  name: string;
  note: string | null;
  language: Language;
  link: string | null;
  createdAt: string;
  /** When the customer last opened their link (backend/views.ts); null: never. */
  lastSeenAt: string | null;
};

const LANGUAGES: Language[] = ["de", "en"];

const newToken = () => randomBytes(24).toString("base64url");

type Row = { id: string; name: string; note: string | null; language: Language; link_token: string | null; created_at: string; seen_at?: string | null };

const customer = (row: Row): Customer => ({
  id: row.id,
  name: row.name,
  note: row.note,
  language: row.language,
  link: row.link_token,
  createdAt: row.created_at,
  lastSeenAt: row.seen_at ?? null,
});

function checkName(name: string): Outcome<string> {
  const n = name.trim();
  return n === "" ? invalid("name: a customer needs a name") : ok(n);
}

function checkLanguage(language: string): Outcome<Language> {
  return (LANGUAGES as string[]).includes(language) ? ok(language as Language) : invalid(`language: one of ${LANGUAGES.join(", ")}`);
}

/** A new customer with a link of their own. */
export function createCustomer(rt: Runtime, input: { name: string; note?: string; language?: Language }): Outcome<Customer> {
  const name = checkName(input.name);
  if (!name.ok) return name;
  const language = checkLanguage(input.language ?? "de");
  if (!language.ok) return language;
  return mutation(rt, () => {
    const row = {
      id: randomUUID(),
      name: name.value,
      note: input.note?.trim() || null,
      language: language.value,
      link_token: newToken(),
      created_at: rt.clock().toISOString(),
    };
    rt.store.insertCustomer(row);
    return ok(customer(row));
  });
}

export function updateCustomer(rt: Runtime, id: string, input: { name?: string; note?: string; language?: Language }): Outcome<Customer> {
  const set: { name?: string; note?: string | null; language?: Language } = {};
  if (input.name !== undefined) {
    const name = checkName(input.name);
    if (!name.ok) return name;
    set.name = name.value;
  }
  if (input.language !== undefined) {
    const language = checkLanguage(input.language);
    if (!language.ok) return language;
    set.language = language.value;
  }
  if (input.note !== undefined) set.note = input.note.trim() || null;
  return mutation(rt, () => {
    if (!rt.store.customer(id)) return notFound(`No customer ${id}.`);
    rt.store.updateCustomer(id, set);
    return ok(customer(rt.store.customer(id)!));
  });
}

export function listCustomers(rt: Runtime): Customer[] {
  return rt.store.customersByName().map(customer);
}

export function getCustomer(rt: Runtime, id: string): Outcome<Customer> {
  const row = rt.store.customer(id);
  return row ? ok(customer(row)) : notFound(`No customer ${id}.`);
}

function setLink(rt: Runtime, id: string, token: string | null): Outcome<Customer> {
  return mutation(rt, () => {
    if (!rt.store.setLinkToken(id, token)) return notFound(`No customer ${id}.`);
    return ok(customer(rt.store.customer(id)!));
  });
}

/** A new link for the customer; the old one stops working. */
export const renewLink = (rt: Runtime, customerId: string): Outcome<Customer> => setLink(rt, customerId, newToken());

/** Takes the customer's link away: nothing opens their page until it is renewed. */
export const revokeLink = (rt: Runtime, customerId: string): Outcome<Customer> => setLink(rt, customerId, null);

/** The customer whose link this token is, or null for an unknown, revoked or replaced token. */
export function customerByToken(rt: Runtime, token: string): Customer | null {
  if (token === "") return null;
  const row = rt.store.customerByLinkToken(token);
  return row ? customer(row) : null;
}
