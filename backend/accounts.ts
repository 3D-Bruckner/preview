// Sign-in, API tokens and MCP's OAuth: next-app-kit's (next-app-kit/signin), wired with preview's env prefix, name, API-token prefix and
// pages; nothing of it is copied here. Who may sign in is PREVIEW_ALLOWED_EMAILS (empty: nobody); the ways in are a code or link by mail
// (PREVIEW_SMTP_*, off when unset or with PREVIEW_SIGNIN_EMAIL=off) and any PREVIEW_OIDC_<NAME>_* provider. The sign-in mail's words and its language pick are the UI's
// (components/copy), which backend/ never imports: the frontend hands them in as MailWording (app/_lib/runtime.ts), and the mail then
// speaks the language the sign-in page did (the switch's cookie, then Accept-Language).
import { join } from "node:path";
import { openAuth, signInFromEnv, type Auth, type MailTexts, type SignInSettings } from "next-app-kit/signin";
import type { Logger } from "pino";

export const ENV_PREFIX = "PREVIEW";
/** The product's name (passkeys, the kit's sign-in); the brand an instance shows is a setting (PREVIEW_BRAND_NAME, config.ts). */
export const APP_NAME = "Preview";
/** API tokens start with this, so a bearer is told apart from an OAuth access token at a glance, and by a secret scanner. */
export const API_TOKEN_PREFIX = "preview_";
/** The sign-in page (app/[lang]/(public)/signin), where the kit and Better Auth send anyone not signed in. */
export const SIGN_IN_PAGE = "/signin";
/** The consent page (app/[lang]/(public)/consent), where an MCP client's or a script's OAuth sign-in asks the person. */
export const CONSENT_PAGE = "/consent";

/** The sign-in mail's words per language (the first is the fallback) and the language of a request, by its headers. */
export type MailWording = { texts: Record<string, MailTexts>; languageOf: (headers: Headers) => string };

/**
 * The kit's sign-in settings from the environment: auth.sqlite next to preview.sqlite; the kit's lines go to the app's log.
 * PREVIEW_SIGNIN_EMAIL=off takes the mailed code away although SMTP is set (for the app's own mail, feedback), so an instance
 * whose operator signs in through a provider keeps that the only way in.
 */
export function signInSettings(env: Record<string, string | undefined>, dataDir: string, log: Logger): SignInSettings {
  const byEmail = env.PREVIEW_SIGNIN_EMAIL?.trim() || "on";
  if (byEmail !== "on" && byEmail !== "off") throw new Error("PREVIEW_SIGNIN_EMAIL must be on or off");
  const settings = signInFromEnv(env, { prefix: ENV_PREFIX, file: join(dataDir, "auth.sqlite"), appName: APP_NAME, log: (line) => log.info(line) });
  if (byEmail === "on") return settings;
  if (settings.providers.length === 0 && !settings.devUser) {
    throw new Error("PREVIEW_SIGNIN_EMAIL=off leaves no way in: set a provider (PREVIEW_OIDC_<NAME>_*) or turn mail sign-in back on");
  }
  return { ...settings, smtp: null };
}

/** Opens auth.sqlite and starts Better Auth as the kit sets it up, with preview's token prefix, pages and sign-in mail. */
export function openPreviewAuth(signIn: SignInSettings, mail: MailWording): Promise<Auth> {
  return openAuth(signIn, {
    apiTokenPrefix: API_TOKEN_PREFIX,
    texts: mail.texts,
    pages: { signIn: SIGN_IN_PAGE, consent: CONSENT_PAGE },
    languageOf: mail.languageOf,
  });
}
