// The app's own mail (a customer's feedback to the operator, feedback.ts) through the same SMTP as the sign-in mail (PREVIEW_SMTP_URL,
// PREVIEW_SMTP_FROM). A failed send throws; the caller logs it without the address. Tests put a sender of their own on the runtime.
import type { Config } from "./config";

export type Mail = { to: string; subject: string; text: string };
export type SendMail = (mail: Mail) => Promise<void>;

/** An SMTP server that never answers fails the send within these, instead of hanging the request. */
const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };

/** Sends through PREVIEW_SMTP_URL; without it every send fails ("no SMTP"). */
export function smtpSender(config: Pick<Config, "smtpUrl" | "smtpFrom">): SendMail {
  return async (mail) => {
    if (!config.smtpUrl) throw Object.assign(new Error("no SMTP (PREVIEW_SMTP_URL)"), { code: "NO_SMTP" });
    const { createTransport } = await import("nodemailer");
    await createTransport({ url: config.smtpUrl, ...TIMEOUTS }).sendMail({ from: config.smtpFrom, ...mail });
  };
}
