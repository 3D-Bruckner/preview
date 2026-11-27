// Models: what a customer is shown; each has numbered versions (versions.ts).
import { randomUUID } from "node:crypto";
import { invalid, notFound, ok, type Outcome } from "./outcome";
import { mutation, type Runtime } from "./runtime";

export type Model = { id: string; customerId: string; title: string; description: string | null; createdAt: string; updatedAt: string };

const model = (row: { id: string; customer_id: string; title: string; description: string | null; created_at: string; updated_at: string }): Model => ({
  id: row.id,
  customerId: row.customer_id,
  title: row.title,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function checkTitle(title: string): Outcome<string> {
  const t = title.trim();
  return t === "" ? invalid("title: a model needs a title") : ok(t);
}

export function createModel(rt: Runtime, input: { customerId: string; title: string; description?: string }): Outcome<Model> {
  const title = checkTitle(input.title);
  if (!title.ok) return title;
  return mutation(rt, () => {
    if (!rt.store.customer(input.customerId)) return notFound(`No customer ${input.customerId}.`);
    const now = rt.clock().toISOString();
    const row = {
      id: randomUUID(),
      customer_id: input.customerId,
      title: title.value,
      description: input.description?.trim() || null,
      created_at: now,
      updated_at: now,
    };
    rt.store.insertModel(row);
    return ok(model(row));
  });
}

export function updateModel(rt: Runtime, id: string, input: { title?: string; description?: string }): Outcome<Model> {
  const set: { title?: string; description?: string | null; updated_at: string } = { updated_at: rt.clock().toISOString() };
  if (input.title !== undefined) {
    const title = checkTitle(input.title);
    if (!title.ok) return title;
    set.title = title.value;
  }
  if (input.description !== undefined) set.description = input.description.trim() || null;
  return mutation(rt, () => {
    if (!rt.store.updateModel(id, set)) return notFound(`No model ${id}.`);
    return ok(model(rt.store.model(id)!));
  });
}

/** Every model, newest first, or one customer's. */
export function listModels(rt: Runtime, filter: { customerId?: string }): Model[] {
  return rt.store.models(filter.customerId).map(model);
}

export function getModel(rt: Runtime, id: string): Outcome<Model> {
  const row = rt.store.model(id);
  return row ? ok(model(row)) : notFound(`No model ${id}.`);
}
