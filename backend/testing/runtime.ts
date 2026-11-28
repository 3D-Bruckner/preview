// A runtime for a test: a fresh preview.sqlite and auth.sqlite in a directory of its own under the test's DATA_DIR, and the sign-in mail
// caught in `mail` instead of sent. `env` adds to or overrides the settings (an empty value unsets one). Close the store at the end
// (afterEach).
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import type { SignInMail } from "next-app-kit/signin";
import { signInSettings, type MailWording } from "../accounts";
import { loadConfig } from "../config";
import { log } from "../log";
import type { Mail } from "../mail";
import { openRuntime, type Runtime } from "../runtime";

/** `mail`: the sign-in mail caught, by address; `sent`: the app's own mail (feedback) caught, in order. */
export type TestRuntime = Runtime & { mail: Map<string, SignInMail>; sent: Mail[] };

/** The sign-in mail in tests: the language is the request's `x-test-lang` header, else English. */
export const TEST_MAIL: MailWording = {
  texts: {
    en: { subject: (code) => `code ${code}`, body: (code, link) => `code ${code}${link ? ` link ${link}` : ""}` },
    de: { subject: (code) => `Code ${code}`, body: (code, link) => `Code ${code}${link ? ` Link ${link}` : ""}` },
  },
  languageOf: (h) => h.get("x-test-lang") ?? "en",
};

/** The one address the test runtime's allowlist lets in: whoever runs the instance. */
export const OWNER = "owner@example.com";

export function testRuntime(env: Record<string, string> = {}, mail: MailWording = TEST_MAIL): TestRuntime {
  const dataDir = mkdtempSync(join(process.env.DATA_DIR!, "rt-"));
  const all: Record<string, string | undefined> = {
    NODE_ENV: "test",
    PUBLIC_URL: "https://preview.example.com",
    PREVIEW_SECRET: "s".repeat(32),
    PREVIEW_ALLOWED_EMAILS: OWNER,
    PREVIEW_SMTP_URL: "smtp://127.0.0.1:2525",
    DATA_DIR: dataDir,
    ...env,
  };
  for (const [k, v] of Object.entries(all)) if (v === "") delete all[k];
  const config = loadConfig(all);
  const caught = new Map<string, SignInMail>();
  const signIn = { ...signInSettings(all, config.dataDir, log), mailer: async (m: SignInMail) => void caught.set(m.to, m) };
  const sent: Mail[] = [];
  return { ...openRuntime(config, signIn, mail), mail: caught, sent, sendMail: async (m) => void sent.push(m) };
}
