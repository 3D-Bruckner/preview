"use client";
import { useState, useTransition, type FormEvent } from "react";
import { Card } from "@/components/Card";
import { useCopy } from "@/components/CopyProvider";
import { Notice } from "@/components/Notice";
import { ui } from "@/components/ui";
import { useWishes } from "@/components/Wishes";
import { sendFeedbackAction, type FeedbackResult } from "./actions";

/** What the customer sent before on this version, as the page shows it (the day already written out). */
export type SentFeedback = {
  createdAt: string;
  day: string;
  comment: string | null;
  wishes: { part: string; partName: string | null; name: string; material: string }[];
};

/**
 * The Rückmeldung card: the colours picked by the parts (ModelReview, useWishes), a comment and the send button; under it what was sent
 * on this version. Sent without a reload: the comment empties on success and stays on a refusal; the picks stay either way.
 */
export function Feedback({ token, modelId, versionNumber, sent }: { token: string; modelId: string; versionNumber: number; sent: SentFeedback[] }) {
  const t = useCopy().customer.feedback;
  const { filaments, picked, labels } = useWishes();
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [busy, start] = useTransition();
  const byId = new Map(filaments.map((f) => [f.id, f]));
  const wishes = [...picked].flatMap(([part, id]) => {
    const f = byId.get(id);
    return f ? [{ part, f }] : [];
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    start(async () => {
      const r = await sendFeedbackAction(token, modelId, versionNumber, fd);
      setResult(r);
      if (r.ok) setComment("");
    });
  }

  return (
    <Card id="feedback" title={t.title} aside={t.on(versionNumber)}>
      <form onSubmit={submit} className="space-y-3 p-4">
        {wishes.length > 0 && (
          <ul aria-label={t.picked} className="flex flex-wrap gap-2 text-[0.8125rem]">
            {wishes.map(({ part, f }) => (
              <li key={part} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5">
                <span
                  aria-hidden="true"
                  className="size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.45)]"
                  style={{ background: f.color }}
                />
                {t.wish(labels.get(part) ?? part, f.name, f.material)}
                <input type="hidden" name="wish" value={`${part}=${f.id}`} />
              </li>
            ))}
          </ul>
        )}
        <label className="block">
          <span className="sr-only">{t.comment}</span>
          <textarea
            name="comment"
            rows={3}
            maxLength={2000}
            value={comment}
            placeholder={t.placeholder}
            onChange={(e) => setComment(e.target.value)}
            className={`${ui.input} mt-0`}
          />
          <span className={ui.hint}>{filaments.length > 0 ? t.hintColours : t.hint}</span>
        </label>
        <button type="submit" disabled={busy} className={`${ui.button} w-full`}>
          {busy ? t.sending : t.send}
        </button>
        <Notice result={result} />
      </form>
      {sent.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {sent.map((s) => (
            <li key={s.createdAt} className="px-4 py-3 text-sm">
              <span className="block font-semibold">
                <time dateTime={s.createdAt}>{t.yours(s.day)}</time>
              </span>
              {s.wishes.length > 0 && (
                <ul aria-label={t.yourWishes} className="mt-1 text-muted">
                  {s.wishes.map((w) => (
                    <li key={w.part}>{t.wish(labels.get(w.part) ?? w.partName ?? w.part, w.name, w.material)}</li>
                  ))}
                </ul>
              )}
              {s.comment && <p className="mt-1 whitespace-pre-line">{s.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
