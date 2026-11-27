// Dates written out in the page's language (conventions: code/language), in the instance's time zone (TZ).
export function formatWhen(lang: string, iso: string | Date): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatDay(lang: string, iso: string | Date): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(typeof iso === "string" ? new Date(iso) : iso);
}
