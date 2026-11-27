// The app's log: pino, structured, English (conventions: Next.js app). Never a token, a link token, a file's name or an email address.
// PREVIEW_LOG_LEVEL (pino's levels: debug, info, warn, error, silent) defaults to info.
import pino from "pino";

export const log = pino({ base: { app: "preview" }, level: process.env.PREVIEW_LOG_LEVEL || "info" });
