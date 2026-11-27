// The queries on models.
import type { Exec } from "./connection";
import type { ModelRow } from "./schema";

export function modelQueries({ q, all, first, run }: Exec) {
  return {
    insertModel: (row: ModelRow) => void run(q.insertInto("models").values(row)),
    model: (id: string): ModelRow | undefined => first(q.selectFrom("models").selectAll().where("id", "=", id)),
    /** Every model, newest first; of one customer when `customerId` is given. */
    models: (customerId?: string): ModelRow[] => {
      let query = q.selectFrom("models").selectAll();
      if (customerId !== undefined) query = query.where("customer_id", "=", customerId);
      return all(query.orderBy("created_at", "desc").orderBy("id"));
    },
    updateModel: (id: string, set: { title?: string; description?: string | null; updated_at: string }): boolean =>
      run(q.updateTable("models").set(set).where("id", "=", id)) > 0,
  };
}
