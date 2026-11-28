"use server";
// The customer's one write: feedback on the version they look at. Their link is the only proof of who they are, so it is passed with
// the form and checked by the domain (sendFeedback starts from customerByToken); a refusal comes back as words in the page's language.
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { sendFeedback } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { copyFor, LANG_HEADER } from "@/components/copy";

export type FeedbackResult = { ok: true; message: string } | { ok: false; error: string };

export async function sendFeedbackAction(token: string, modelId: string, versionNumber: number, fd: FormData): Promise<FeedbackResult> {
  const t = copyFor((await headers()).get(LANG_HEADER) ?? "").customer.feedback;
  const wishes = fd.getAll("wish").flatMap((w) => {
    const [part, filamentId] = String(w).split("=");
    return part && filamentId ? [{ part, filamentId }] : [];
  });
  const out = await sendFeedback(runtime(), token, { modelId, versionNumber, comment: String(fd.get("comment") ?? ""), wishes });
  if (!out.ok) {
    if (out.reason === "limited") return { ok: false, error: t.limited };
    if (out.reason === "invalid" && out.message.startsWith("feedback:")) return { ok: false, error: t.empty };
    return { ok: false, error: t.failed };
  }
  refresh();
  return { ok: true, message: t.sent };
}
