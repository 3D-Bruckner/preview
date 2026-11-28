// What a domain function that can be refused returns: its value, or why not. The reasons map to REST's 404, 400, 409 and 429; the message is
// English and names what was wrong (the field, the missing customer, the clashing number).
export type Reason = "not_found" | "invalid" | "conflict" | "limited";

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: Reason; message: string };

export const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
export const done: Outcome<void> = { ok: true, value: undefined };
export const notFound = (message: string): Outcome<never> => ({ ok: false, reason: "not_found", message });
export const invalid = (message: string): Outcome<never> => ({ ok: false, reason: "invalid", message });
export const conflict = (message: string): Outcome<never> => ({ ok: false, reason: "conflict", message });
/** Too many of something in too short a time (a customer's feedback). */
export const limited = (message: string): Outcome<never> => ({ ok: false, reason: "limited", message });
