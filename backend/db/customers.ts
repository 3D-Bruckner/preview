// The queries on customers.
import type { Exec } from "./connection";
import type { CustomerRow } from "./schema";

export function customerQueries({ q, all, first, run }: Exec) {
  return {
    insertCustomer: (row: CustomerRow) => void run(q.insertInto("customers").values(row)),
    customer: (id: string): CustomerRow | undefined => first(q.selectFrom("customers").selectAll().where("id", "=", id)),
    /** The customer whose link has this token: a lookup by the unique index, never a scan. */
    customerByLinkToken: (token: string): CustomerRow | undefined => first(q.selectFrom("customers").selectAll().where("link_token", "=", token)),
    customersByName: (): CustomerRow[] => all(q.selectFrom("customers").selectAll().orderBy("name").orderBy("created_at")),
    updateCustomer: (id: string, set: { name?: string; note?: string | null; language?: "de" | "en" }): boolean =>
      Object.keys(set).length === 0 || run(q.updateTable("customers").set(set).where("id", "=", id)) > 0,
    setLinkToken: (id: string, token: string | null): boolean => run(q.updateTable("customers").set({ link_token: token }).where("id", "=", id)) > 0,
  };
}
