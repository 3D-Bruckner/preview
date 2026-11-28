// preview's wiring of next-app-kit's sign-in (backend/accounts.ts, the runtime's auth, person and apiCaller): who gets in, which token
// works where, the dev user, passkeys and the sign-in mail's language. The behaviour itself is the kit's and tested there; these tests
// check that preview passes it what it needs. Better Auth runs for real behind a local HTTP server (an MCP client's OAuth sign-in and the
// key set /mcp checks tokens against need one), with auth.sqlite in the test's temporary DATA_DIR and the mail caught.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { defineTool, mcpRoute, type McpContext } from "next-app-kit/mcp";
import { authHandler, wellKnownHandlers } from "next-app-kit/next";
import { restRoute, type Op } from "next-app-kit/rest";
import { signInMethods } from "next-app-kit/signin";
import { SignInRefused, signedInCookie } from "next-app-kit/testing";
import { createApiToken } from "next-app-kit/tokens";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as z from "zod";
import { API_TOKEN_PREFIX, signInSettings } from "./accounts";
import { log } from "./log";
import { OWNER, testRuntime, type TestRuntime } from "./testing/runtime";

// /mcp needs a tool to list; preview's own come with its MCP task.
const ping = defineTool({
  name: "ping",
  description: "Answers pong.",
  input: z.object({}),
  output: z.object({ pong: z.boolean() }),
  handle: async () => ({ pong: true, guidance: [] }),
});

/** preview's runtime behind a local HTTP server at `base`: Better Auth's routes, the OAuth metadata and /mcp, as the route files serve them. */
async function serve(env: Record<string, string> = {}): Promise<{ rt: TestRuntime; base: string; mcp: McpContext; close: () => Promise<void> }> {
  let handle: (req: Request) => Promise<Response> = async () => new Response(null, { status: 503 });
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) headers.append(k, one);
    const reply = await handle(
      new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
      }),
    );
    for (const [k, v] of reply.headers) if (k !== "set-cookie") res.setHeader(k, v);
    if (reply.headers.getSetCookie().length) res.setHeader("set-cookie", reply.headers.getSetCookie());
    res.writeHead(reply.status);
    res.end(Buffer.from(await reply.arrayBuffer()));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const base = `http://localhost:${port}`;
  const rt = testRuntime({ PUBLIC_URL: base, PORT: String(port), ...env });
  const auth = authHandler(rt.auth);
  const wellKnown = wellKnownHandlers(rt.auth);
  const mcp: McpContext = {
    auth: await rt.auth(),
    signIn: rt.signIn,
    tools: [ping],
    serverInfo: { name: "preview", version: "0" },
    instructions: "",
    log: () => {},
  };
  handle = async (req) => {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/api/auth/")) return req.method === "GET" ? auth.GET(req) : auth.POST(req);
    if (path.startsWith("/.well-known/oauth-authorization-server")) return wellKnown.authorizationServer(req);
    if (path === "/mcp") return mcpRoute(req, mcp);
    return new Response(null, { status: 404 });
  };
  return {
    rt,
    base,
    mcp,
    close: async () => {
      rt.store.close();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}

const bearer = (base: string, path: string, token: string, init: RequestInit = {}) =>
  new Request(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers as Record<string, string> | undefined) } });

/** An MCP tools/list call, as an MCP client sends it (the stateless protocol the kit speaks). */
const V = "2026-07-28";
const listTools = (base: string, token: string) =>
  bearer(base, "/mcp", token, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": V, "mcp-method": "tools/list" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": V,
          "io.modelcontextprotocol/clientInfo": { name: "t", version: "0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });

describe("sign-in, wired from next-app-kit", () => {
  let s: Awaited<ReturnType<typeof serve>>;
  let cookie: string;
  let owner: string;

  beforeAll(async () => {
    s = await serve();
    cookie = await signedInCookie(await s.rt.auth(), OWNER);
    owner = (await s.rt.person(new Headers({ cookie })))!.id;
  });

  afterAll(async () => {
    await s.close();
  });

  it("notAllowlistedGetsNoSession", async () => {
    expect(owner).toBeTruthy();
    expect((await s.rt.person(new Headers({ cookie })))?.email).toBe(OWNER);
    await expect(signedInCookie(await s.rt.auth(), "eve@example.com")).rejects.toBeInstanceOf(SignInRefused);
    // Nobody else even gets a mail, and a stranger's request is nobody.
    const asked = await fetch(`${s.base}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: s.base },
      body: JSON.stringify({ email: "eve@example.com", type: "sign-in" }),
    });
    expect(asked.status).toBe(200);
    expect(s.rt.mail.has("eve@example.com")).toBe(false);
    expect(await s.rt.person(new Headers())).toBeNull();
  });

  it("mails the sign-in code in the language preview's languageOf picks, with a link to the sign-in page's next", async () => {
    for (const lang of ["de", "en"]) {
      const r = await fetch(`${s.base}/api/auth/email-otp/send-verification-otp`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: s.base, "x-test-lang": lang, referer: `${s.base}/signin?next=%2Fcustomers%2F7` },
        body: JSON.stringify({ email: OWNER, type: "sign-in" }),
      });
      expect(r.status).toBe(200);
      const sent = s.rt.mail.get(OWNER)!;
      expect(sent.language).toBe(lang);
      expect(new URL(sent.link!).searchParams.get("callbackURL")).toBe("/customers/7");
    }
  });

  it("apiTokenRefusedOnMcp", async () => {
    const made = await createApiToken(await s.rt.auth(), owner, { name: "script", scope: "read+write" });
    if ("error" in made) throw new Error(made.error);
    expect(made.token.startsWith(API_TOKEN_PREFIX)).toBe(true);
    // The token works where it belongs, /api/v1 ...
    expect(await s.rt.apiCaller(bearer(s.base, "/api/v1/things", made.token))).toMatchObject({ actor: OWNER, scope: "read+write" });
    // ... and never on /mcp.
    const r = await mcpRoute(listTools(s.base, made.token), s.mcp);
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain(`${s.base}/.well-known/oauth-protected-resource/mcp`);
  });

  it("mcpTokenRefusedOnRest: an MCP client's OAuth sign-in goes through /signin and /consent, and its token works on /mcp only", async () => {
    const meta = (await (await fetch(`${s.base}/.well-known/oauth-authorization-server/api/auth`)).json()) as Record<string, string>;
    const redirect = "https://claude.example/cb";
    const reg = await fetch(meta.registration_endpoint!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Claude",
        redirect_uris: [redirect],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(reg.status).toBe(201);
    const { client_id } = (await reg.json()) as { client_id: string };
    const verifier = randomBytes(32).toString("base64url");
    const authorize = new URL(meta.authorization_endpoint!);
    for (const [k, v] of Object.entries({
      response_type: "code",
      client_id,
      redirect_uri: redirect,
      scope: "openid offline_access",
      state: "st",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      resource: `${s.base}/mcp`,
    }))
      authorize.searchParams.set(k, v);
    const where = async (r: Response) => new URL(r.status === 302 ? r.headers.get("location")! : ((await r.json()) as { url: string }).url, s.base);
    // Nobody signed in: preview's sign-in page. Signed in: preview's consent page.
    expect((await where(await fetch(authorize, { redirect: "manual", headers: { accept: "text/html" } }))).pathname).toBe("/signin");
    const consent = await where(await fetch(authorize, { redirect: "manual", headers: { accept: "text/html", cookie } }));
    expect(consent.pathname).toBe("/consent");
    const allowed = await fetch(`${s.base}/api/auth/oauth2/consent`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: s.base, cookie },
      body: JSON.stringify({ accept: true, oauth_query: consent.search.slice(1) }),
    });
    expect(allowed.status).toBe(200);
    const back = new URL(((await allowed.json()) as { url: string }).url);
    const token = await fetch(meta.token_endpoint!, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: back.searchParams.get("code")!,
        redirect_uri: redirect,
        client_id,
        code_verifier: verifier,
        resource: `${s.base}/mcp`,
      }),
    });
    expect(token.status).toBe(200);
    const { access_token } = (await token.json()) as { access_token: string };
    expect((await mcpRoute(listTools(s.base, access_token), s.mcp)).status).toBe(200);
    expect(await s.rt.apiCaller(bearer(s.base, "/api/v1/things", access_token))).toBeNull();
  });

  it("readTokenCannotWrite", async () => {
    const made = await createApiToken(await s.rt.auth(), owner, { name: "reader", scope: "read" });
    if ("error" in made) throw new Error(made.error);
    const ok = { status: 200, description: "ok", schema: z.object({}) };
    const ops: Op<null>[] = [
      {
        method: "GET",
        path: "/things",
        operationId: "listThings",
        noTool: "test",
        summary: "List",
        tag: "Test",
        ok,
        errors: [401],
        handle: () => ({ status: 200, body: {} }),
      },
      {
        method: "POST",
        path: "/things",
        operationId: "makeThing",
        noTool: "test",
        summary: "Make",
        tag: "Test",
        ok,
        errors: [401, 403],
        handle: () => ({ status: 200, body: {} }),
      },
    ];
    const call = async (method: string) => {
      const req = bearer(s.base, "/api/v1/things", made.token, { method });
      return (await restRoute(req, ops, null, await s.rt.apiCaller(req), { base: s.base, log: () => {} })).status;
    };
    expect(await call("GET")).toBe(200);
    expect(await call("POST")).toBe(403);
  });

  it("passkeyPluginEnabled", async () => {
    expect((await fetch(`${s.base}/api/auth/passkey/generate-register-options`)).status).toBe(401);
    const r = await fetch(`${s.base}/api/auth/passkey/generate-register-options`, { headers: { cookie } });
    expect(r.status).toBe(200);
    const options = (await r.json()) as { challenge: string; rp: { name: string; id: string } };
    expect(options.challenge).toBeTruthy();
    expect(options.rp).toEqual({ name: "Preview", id: "localhost" });
  });
});

describe("who may sign in", () => {
  it("emptyAllowlistLetsNobodyIn", async () => {
    const rt = testRuntime({ PREVIEW_ALLOWED_EMAILS: "" });
    try {
      expect(rt.signIn.allowed).toEqual([]);
      await expect(signedInCookie(await rt.auth(), OWNER)).rejects.toBeInstanceOf(SignInRefused);
    } finally {
      rt.store.close();
    }
  });

  it("devUserRefusedInProduction", async () => {
    const env = { PUBLIC_URL: "https://preview.example.com", PREVIEW_SECRET: "s".repeat(32), PREVIEW_DEV_USER: OWNER, PREVIEW_SMTP_URL: "smtp://x" };
    expect(() => signInSettings({ ...env, NODE_ENV: "production" }, process.env.DATA_DIR!, log)).toThrow(/PREVIEW_DEV_USER/);
    // Outside production the dev user is everyone, without a session.
    const rt = testRuntime({ PREVIEW_DEV_USER: OWNER });
    try {
      expect(await rt.person(new Headers())).toEqual({ id: `dev:${OWNER}`, email: OWNER });
    } finally {
      rt.store.close();
    }
  });

  describe("PREVIEW_SIGNIN_EMAIL", () => {
    const base = { PUBLIC_URL: "https://preview.example.com", PREVIEW_SECRET: "s".repeat(32), PREVIEW_SMTP_URL: "smtp://u:p@smtp.example.org:587" };
    const authentik = {
      PREVIEW_OIDC_AUTHENTIK_CLIENT_ID: "preview",
      PREVIEW_OIDC_AUTHENTIK_CLIENT_SECRET: "secret",
      PREVIEW_OIDC_AUTHENTIK_ISSUER: "https://auth.example.org/application/o/preview/",
    };
    const settings = (env: Record<string, string>) => signInSettings(env, process.env.DATA_DIR!, log);

    it("offers the mailed code wherever SMTP is set, by default", () => {
      expect(signInMethods(settings({ ...base, ...authentik })).email).toBe(true);
    });

    it("off: no mailed code although SMTP is set (it still sends the app's own mail), the providers stay", () => {
      const s = settings({ ...base, ...authentik, PREVIEW_SIGNIN_EMAIL: "off" });
      expect(s.smtp).toBeNull();
      expect(signInMethods(s)).toMatchObject({ email: false, providers: [expect.objectContaining({ id: "authentik" })] });
    });

    it("off with no provider left is refused, as no way in at all", () => {
      expect(() => settings({ ...base, PREVIEW_SIGNIN_EMAIL: "off" })).toThrow(/PREVIEW_SIGNIN_EMAIL/);
    });

    it("refuses anything but on or off", () => {
      expect(() => settings({ ...base, ...authentik, PREVIEW_SIGNIN_EMAIL: "no" })).toThrow(/PREVIEW_SIGNIN_EMAIL must be on or off/);
    });
  });

  it("names preview's sign-in: auth.sqlite in DATA_DIR, the app's name, preview's prefix", async () => {
    const rt = testRuntime();
    try {
      expect(rt.signIn.prefix).toBe("PREVIEW");
      expect(rt.signIn.appName).toBe("Preview");
      expect(rt.signIn.file).toBe(`${rt.config.dataDir}/auth.sqlite`);
    } finally {
      rt.store.close();
    }
  });
});
