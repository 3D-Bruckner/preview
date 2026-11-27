// preview's settings, read once from the environment at start: PREVIEW_*, plus PUBLIC_URL and DATA_DIR. A bad setting stops the start with
// a message naming the variable. VARIABLES below names every variable the app and its image read, these and the ones read elsewhere (the
// kit's sign-in through signInFromEnv, the log, Node, the image's entrypoint); .env.example and docs/configuration.md list exactly those
// (envExampleListsEveryVariable in config.test.ts), so the three change together.
//
// Everything that names whoever runs an instance is a setting (the brand's name, link, accent colour and logo, the imprint and privacy
// links): the product itself names no operator, and its defaults are neutral.
import { isAbsolute, relative, resolve } from "node:path";
import * as z from "zod";

export type Brand = {
  /** PREVIEW_BRAND_NAME: shown in the header and the page title. */
  name: string;
  /** PREVIEW_BRAND_URL: where the header's name links to; none: the name is plain text. */
  url?: string;
  /** PREVIEW_ACCENT_COLOR: the accent, as #rrggbb (a #rgb setting is written out). */
  accentColor: string;
  /** PREVIEW_LOGO: the logo's absolute path, inside DATA_DIR; none: the header shows the name only. */
  logo?: string;
  /** PREVIEW_IMPRINT_URL: the footer's imprint link on every page. */
  imprintUrl?: string;
  /** PREVIEW_PRIVACY_URL: the footer's privacy link on every page. */
  privacyUrl?: string;
};

export type Config = {
  /** PUBLIC_URL without a trailing slash: links in mails and MCP results, the OAuth issuer. */
  publicUrl: string;
  /** DATA_DIR: preview.sqlite, auth.sqlite and the files. */
  dataDir: string;
  /** PREVIEW_SECRET: signs sessions and tokens. */
  secret: string;
  /** PREVIEW_ALLOWED_EMAILS: addresses and @domain entries; empty lets nobody in. */
  allowedEmails: string[];
  smtpUrl?: string;
  smtpFrom?: string;
  /** PREVIEW_MAX_UPLOAD_MB: the largest upload a request may send, in megabytes (default 100). */
  maxUploadMb: number;
  /** Who runs this instance, as its pages show it. */
  brand: Brand;
  /** PREVIEW_DEV_USER: development only, everyone reaching the app is this person. */
  devUser?: string;
};

/** The accent when PREVIEW_ACCENT_COLOR is unset: a plain blue, 6.7:1 against white (WCAG AA for text). */
export const DEFAULT_ACCENT = "#1d4ed8";
export const DEFAULT_BRAND_NAME = "Preview";

// An empty value counts as unset, so a copy of .env.example with a blank line keeps the default.
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optional = z.preprocess(blank, z.string().trim().optional());
const optionalUrl = (name: string) => z.preprocess(blank, z.url({ protocol: /^https?$/, error: `${name} must be an http(s) URL` }).optional());

const MAX_UPLOAD = "PREVIEW_MAX_UPLOAD_MB must be a whole number of megabytes, at least 1";
const BRAND_NAME = "PREVIEW_BRAND_NAME must be at most 80 characters";
const ACCENT = "PREVIEW_ACCENT_COLOR must be a hex colour such as #1d4ed8";
const LOGO = "PREVIEW_LOGO must be an .svg or .png file inside DATA_DIR, such as brand/logo.svg";

const schema = z.object({
  NODE_ENV: z.string().optional(),
  PUBLIC_URL: z.url({ protocol: /^https?$/, error: "PUBLIC_URL must be the app's public URL, such as https://preview.example.com" }),
  DATA_DIR: optional,
  PREVIEW_SECRET: z.string({ error: "PREVIEW_SECRET must be at least 32 characters" }).min(32, "PREVIEW_SECRET must be at least 32 characters"),
  PREVIEW_ALLOWED_EMAILS: optional,
  PREVIEW_SMTP_URL: optional,
  PREVIEW_SMTP_FROM: optional,
  PREVIEW_MAX_UPLOAD_MB: z.preprocess(blank, z.coerce.number({ error: MAX_UPLOAD }).int(MAX_UPLOAD).min(1, MAX_UPLOAD).optional()),
  PREVIEW_BRAND_NAME: z.preprocess(blank, z.string().trim().max(80, BRAND_NAME).optional()),
  PREVIEW_BRAND_URL: optionalUrl("PREVIEW_BRAND_URL"),
  PREVIEW_ACCENT_COLOR: z.preprocess(
    blank,
    z
      .string({ error: ACCENT })
      .trim()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, ACCENT)
      .optional(),
  ),
  PREVIEW_LOGO: z.preprocess(
    blank,
    z
      .string({ error: LOGO })
      .trim()
      .regex(/\.(?:svg|png)$/i, LOGO)
      .optional(),
  ),
  PREVIEW_IMPRINT_URL: optionalUrl("PREVIEW_IMPRINT_URL"),
  PREVIEW_PRIVACY_URL: optionalUrl("PREVIEW_PRIVACY_URL"),
  PREVIEW_DEV_USER: optional,
});

/** Who reads a variable that isn't loadConfig's own. */
type ReadBy = "next-app-kit" | "backend/log.ts" | "Node" | "docker-entrypoint.mjs";

/**
 * Every variable preview reads: loadConfig's (the schema's keys) and the rest, each with who reads it. `<NAME>` stands for a sign-in
 * provider's name (GITHUB, GOOGLE, APPLE or any OIDC one).
 */
export const VARIABLES: Record<string, "loadConfig" | ReadBy> = {
  ...(Object.fromEntries(
    Object.keys(schema.shape)
      .filter((k) => k !== "NODE_ENV")
      .map((k) => [k, "loadConfig"]),
  ) as Record<string, "loadConfig">),
  "PREVIEW_OIDC_<NAME>_CLIENT_ID": "next-app-kit",
  "PREVIEW_OIDC_<NAME>_CLIENT_SECRET": "next-app-kit",
  "PREVIEW_OIDC_<NAME>_ISSUER": "next-app-kit",
  "PREVIEW_OIDC_<NAME>_LABEL": "next-app-kit",
  PREVIEW_E2E: "next-app-kit",
  PORT: "next-app-kit",
  PREVIEW_LOG_LEVEL: "backend/log.ts",
  TZ: "Node",
  NODE_EXTRA_CA_CERTS: "Node",
  PUID: "docker-entrypoint.mjs",
  PGID: "docker-entrypoint.mjs",
};

/** #rgb written out as #rrggbb, lower case. */
function longHex(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

/** PREVIEW_LOGO as an absolute path inside `dataDir` (a relative one is taken from there); throws when it would lead out of it. */
function logoPath(dataDir: string, logo: string): string {
  const root = resolve(dataDir);
  const path = resolve(root, logo);
  const rel = relative(root, path);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error(LOGO);
  return path;
}

/** The settings from `env`; throws naming every variable that is wrong. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  const e = parsed.data;
  if (e.PREVIEW_DEV_USER && e.NODE_ENV === "production") throw new Error("PREVIEW_DEV_USER is not allowed in production");
  const dataDir = e.DATA_DIR ?? "/data";
  const brand: Brand = { name: e.PREVIEW_BRAND_NAME ?? DEFAULT_BRAND_NAME, accentColor: longHex(e.PREVIEW_ACCENT_COLOR ?? DEFAULT_ACCENT) };
  if (e.PREVIEW_BRAND_URL) brand.url = e.PREVIEW_BRAND_URL;
  if (e.PREVIEW_LOGO) brand.logo = logoPath(dataDir, e.PREVIEW_LOGO);
  if (e.PREVIEW_IMPRINT_URL) brand.imprintUrl = e.PREVIEW_IMPRINT_URL;
  if (e.PREVIEW_PRIVACY_URL) brand.privacyUrl = e.PREVIEW_PRIVACY_URL;
  const config: Config = {
    publicUrl: e.PUBLIC_URL.replace(/\/+$/, ""),
    dataDir,
    secret: e.PREVIEW_SECRET,
    allowedEmails: (e.PREVIEW_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
    maxUploadMb: e.PREVIEW_MAX_UPLOAD_MB ?? 100,
    brand,
  };
  if (e.PREVIEW_SMTP_URL) config.smtpUrl = e.PREVIEW_SMTP_URL;
  if (e.PREVIEW_SMTP_FROM) config.smtpFrom = e.PREVIEW_SMTP_FROM;
  if (e.PREVIEW_DEV_USER) config.devUser = e.PREVIEW_DEV_USER;
  return config;
}
