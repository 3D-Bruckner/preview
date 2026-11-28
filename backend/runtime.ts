// What every surface works with: the settings, the store (backend/db, the only way to the database), the clock, fetch, the log and
// sign-in (the kit's, backend/accounts.ts), opened once per process. Tests open their own with openRuntime and a config of their own (or
// testing/runtime.ts); the process's is runtime() in backend/index.ts, which the frontend calls with the sign-in mail's words
// (app/_lib/runtime.ts).
import { personOf, type Auth, type Person, type SignInSettings } from "next-app-kit/signin";
import { restCaller, type RestCaller } from "next-app-kit/tokens";
import type { Logger } from "pino";
import { openPreviewAuth, type MailWording } from "./accounts";
import type { Config } from "./config";
import { openStore, type Store } from "./db";
import { log } from "./log";
import { smtpSender, type SendMail } from "./mail";
import type { Outcome } from "./outcome";

export type Runtime = {
  config: Config;
  store: Store;
  clock: () => Date;
  fetch: typeof fetch;
  log: Logger;
  /** The kit's sign-in settings (PREVIEW_*, from signInFromEnv). */
  signIn: SignInSettings;
  /** Better Auth, opened at the first call (auth.sqlite migrated then); a failed start is tried again at the next. */
  auth: () => Promise<Auth>;
  /**
   * Who a page's or the app's own route's request is, by its session cookie: the kit's personOf, with PREVIEW_DEV_USER when it is set
   * (never in production). Tests may set a person of their own.
   */
  person: (h: Headers) => Promise<Person | null>;
  /** Who a request with an API token or an OAuth access token for /api/v1 is: the kit's restCaller. */
  apiCaller: (req: Request) => Promise<RestCaller | null>;
  /** Wakes the slicer's worker (backend/slicer.ts) when a version may need slicing; does nothing while no worker runs. */
  wakeSlicer: () => void;
  /** Sends the app's own mail (mail.ts); tests catch it instead. */
  sendMail: SendMail;
};

export function openRuntime(config: Config, signIn: SignInSettings, mail: MailWording): Runtime {
  let opened: Promise<Auth> | null = null;
  const auth = (): Promise<Auth> => {
    if (!opened) {
      const p = openPreviewAuth(signIn, mail);
      opened = p;
      p.catch(() => {
        if (opened === p) opened = null;
      });
    }
    return opened;
  };
  return {
    config,
    store: openStore(config.dataDir),
    clock: () => new Date(),
    fetch: globalThis.fetch,
    log,
    signIn,
    auth,
    person: async (h) => personOf(h, await auth(), signIn.devUser),
    apiCaller: async (req) => restCaller(req, await auth(), signIn),
    wakeSlicer: () => {},
    sendMail: smtpSender(config),
  };
}

class Refused {
  constructor(readonly outcome: Outcome<never>) {}
}

/** Runs a domain mutation in one transaction: a refusal rolls back whatever `fn` wrote before refusing. */
export function mutation<T>(rt: Runtime, fn: () => Outcome<T>): Outcome<T> {
  try {
    return rt.store.transaction(() => {
      const o = fn();
      if (!o.ok) throw new Refused(o);
      return o;
    });
  } catch (e) {
    if (e instanceof Refused) return e.outcome;
    throw e;
  }
}
