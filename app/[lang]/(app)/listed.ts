import { listCustomers, listFeedback, listModels, type Runtime } from "@/backend";
import type { ListedCustomer } from "./CustomerList";

/** The customer list's rows: each customer with how many models they have and how much of their feedback is not seen yet. */
export function listedCustomers(rt: Runtime): ListedCustomer[] {
  const unseen = new Map<string, number>();
  for (const f of listFeedback(rt, { unseen: true })) unseen.set(f.customerId, (unseen.get(f.customerId) ?? 0) + 1);
  return listCustomers(rt).map((c) => ({
    id: c.id,
    name: c.name,
    models: listModels(rt, { customerId: c.id }).length,
    unseen: unseen.get(c.id) ?? 0,
    noLink: !c.link,
  }));
}

/** The two columns of the customers' pages: the list beside the page from 768 px; on a phone one after the other. */
export const split = "grid items-start gap-6 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]";
