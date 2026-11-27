// Dates written out in the page's language (conventions: code/language), in the instance's time zone (TZ).
export function formatWhen(lang: string, iso: string | Date): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatDay(lang: string, iso: string | Date): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Whether `iso` lies within the last `days` days before `now`: a model's "new version" badge on the customer's overview. */
export function isRecent(iso: string, now: Date, days = 7): boolean {
  return now.getTime() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}
