// The queries on feedback: a customer's comments and colour wishes per version (backend/feedback.ts), with the version, model and
// customer they belong to.
import type { Exec } from "./connection";
import type { FeedbackRow } from "./schema";

export type FeedbackListRow = FeedbackRow & { version_number: number; model_id: string; model_title: string; customer_name: string };

export type FeedbackFilter = { customerId?: string; modelId?: string; versionIds?: string[]; unseen?: boolean };

export function feedbackQueries({ q, all, run }: Exec) {
  return {
    insertFeedback: (row: FeedbackRow) => void run(q.insertInto("feedback").values(row)),
    /** How many a customer sent since `since` (ISO time). */
    feedbackCountSince: (customerId: string, since: string): number =>
      Number(
        all(
          q
            .selectFrom("feedback")
            .select((e) => e.fn.countAll().as("n"))
            .where("customer_id", "=", customerId)
            .where("created_at", ">", since),
        )[0]?.n ?? 0,
      ),
    /** Feedback newest first, with its version's number and its model and customer. */
    feedback: (filter: FeedbackFilter): FeedbackListRow[] => {
      if (filter.versionIds?.length === 0) return [];
      let query = q
        .selectFrom("feedback")
        .innerJoin("versions", "versions.id", "feedback.version_id")
        .innerJoin("models", "models.id", "versions.model_id")
        .innerJoin("customers", "customers.id", "feedback.customer_id")
        .selectAll("feedback")
        .select(["versions.number as version_number", "models.id as model_id", "models.title as model_title", "customers.name as customer_name"])
        .orderBy("feedback.created_at", "desc")
        .orderBy("feedback.id");
      if (filter.customerId) query = query.where("feedback.customer_id", "=", filter.customerId);
      if (filter.modelId) query = query.where("models.id", "=", filter.modelId);
      if (filter.versionIds) query = query.where("feedback.version_id", "in", filter.versionIds);
      if (filter.unseen) query = query.where("feedback.seen_at", "is", null);
      return all(query) as FeedbackListRow[];
    },
    /** Which of `ids` exist. */
    feedbackIds: (ids: string[]): string[] => (ids.length === 0 ? [] : all(q.selectFrom("feedback").select("id").where("id", "in", ids)).map((r) => r.id)),
    /** Marks those of `ids` not seen yet as seen at `at`; how many. */
    markFeedbackSeen: (ids: string[], at: string): number =>
      ids.length === 0 ? 0 : run(q.updateTable("feedback").set({ seen_at: at }).where("id", "in", ids).where("seen_at", "is", null)),
    unseenFeedbackCount: (): number =>
      Number(
        all(
          q
            .selectFrom("feedback")
            .select((e) => e.fn.countAll().as("n"))
            .where("seen_at", "is", null),
        )[0]?.n ?? 0,
      ),
  };
}
