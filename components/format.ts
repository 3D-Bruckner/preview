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

/** A length in mm as the measurements show it: whole millimetres from 10 mm, one decimal below (0 stays 0), no thousands separator. */
export function formatMm(mm: number, lang: string): string {
  const small = mm > 0 && mm < 9.95;
  return new Intl.NumberFormat(lang, { useGrouping: false, maximumFractionDigits: small ? 1 : 0, minimumFractionDigits: small ? 1 : 0 }).format(mm);
}

/** A weight in grams as the print figures show it: one decimal below 100 g (none when it is whole), whole grams from there. */
export function formatGrams(g: number, lang: string): string {
  return new Intl.NumberFormat(lang, { useGrouping: false, maximumFractionDigits: g < 100 ? 1 : 0 }).format(g);
}

/** A print time in whole hours and minutes, rounded to the minute and at least one; the copy writes it out. */
export function hoursMinutes(seconds: number): { h: number; m: number } {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

/**
 * When something happened, as a glance reads it: "heute, 09:41" / "today, 09:41", "gestern, …", else the day ("26. Nov."). For when a
 * customer last looked.
 */
export function formatSeen(lang: string, iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const dayOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const days = Math.round((Date.parse(dayOf(now)) - Date.parse(dayOf(at))) / 86_400_000);
  const time = new Intl.DateTimeFormat(lang, { timeStyle: "short" }).format(at);
  if (days === 0 || days === 1) return `${new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-days, "day")}, ${time}`;
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", ...(days > 300 ? { year: "numeric" } : {}) }).format(at);
}
