import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { createCustomer, type Customer } from "@/backend";
import { runtime } from "@/app/_lib/runtime";
import { config, proxy } from "./proxy";

const get = (path: string, headers: Record<string, string> = {}) => proxy(new NextRequest(new URL(path, "http://localhost"), { headers }));
const rewrite = (r: Response) => r.headers.get("x-middleware-rewrite");

describe("proxy", () => {
  it("rewrites a page to its language, which no URL carries", () => {
    expect(rewrite(get("/", { "accept-language": "de-DE,de;q=0.9" }))).toBe("http://localhost/de");
    expect(rewrite(get("/customers/abc?x=1", { "accept-language": "en" }))).toBe("http://localhost/en/customers/abc?x=1");
    // Without a cookie or an Accept-Language the UI speaks German.
    expect(rewrite(get("/customers"))).toBe("http://localhost/de/customers");
  });

  it("prefers the language picked in the switch (its cookie) over the browser's", () => {
    expect(rewrite(get("/", { "accept-language": "de", cookie: "preview_lang=en" }))).toBe("http://localhost/en");
  });

  it("passes the language on as a request header", () => {
    expect(get("/", { "accept-language": "de" }).headers.get("x-middleware-request-x-preview-lang")).toBe("de");
  });

  it("bodiesBypassProxy: never runs on a route handler, so no post is cut at Next's 10 MB proxied-body limit (a version's upload)", () => {
    const runs = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    for (const path of [
      "/api/models/abc/versions",
      "/api/v1/customers",
      "/api/v1/tokens/abc",
      "/api/auth/email-otp/send-verification-otp",
      "/api/language",
      "/api/test/sign-in",
      "/mcp",
      "/health",
      "/.well-known/oauth-protected-resource/mcp",
      "/_next/static/chunks/x.js",
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/favicon.ico",
      "/brand/logo",
      "/k/abc/files/v1/model.3mf",
      "/k/abc/files/v1/0b6f3c1e-1111-4222-8333-944445555666",
    ])
      expect(runs(path), path).toBe(false);
    for (const path of [
      "/k/abc",
      "/k/abc/0b6f3c1e-1111-4222-8333-944445555666",
      "/brand",
      "/",
      "/customers",
      "/customers/abc",
      "/models/abc",
      "/signin?next=%2F",
      "/consent",
      "/settings",
      "/mcpx",
      "/healthy",
    ])
      expect(runs(path), path).toBe(true);
  });
});

describe("proxy and the Home Screen's files", () => {
  it("staticAssetsNotRewritten: never runs on the manifest, the icons or anything with a file extension", () => {
    for (const path of [
      "/manifest.webmanifest",
      "/apple-icon.png",
      "/icon.svg",
      "/favicon.ico",
      "/icons/icon-192.png",
      "/icons/maskable-512.png",
      "/robots.txt",
    ])
      expect(unstable_doesMiddlewareMatch({ config, url: path }), path).toBe(false);
  });
});

describe("proxy on a customer's pages", () => {
  // The process's runtime, on the test's DATA_DIR (the proxy looks the customer's language up through it).
  let en: Customer;
  let de: Customer;
  beforeAll(() => {
    process.env.PUBLIC_URL = "https://preview.example.com";
    process.env.PREVIEW_SECRET = "s".repeat(32);
    process.env.PREVIEW_SMTP_URL = "smtp://127.0.0.1:2525";
    const ok = <T>(o: { ok: true; value: T } | { ok: false }) => (o.ok ? o.value : expect.fail("not created"));
    en = ok(createCustomer(runtime(), { name: "Anna", language: "en" }));
    de = ok(createCustomer(runtime(), { name: "Bert" }));
  });
  afterAll(() => runtime().store.close());

  it("opens them in the customer's language, not the browser's, when the visitor picked none", () => {
    expect(rewrite(get(`/k/${en.link}`, { "accept-language": "de" }))).toBe(`http://localhost/en/k/${en.link}`);
    expect(rewrite(get(`/k/${de.link}/m1`, { "accept-language": "en" }))).toBe(`http://localhost/de/k/${de.link}/m1`);
  });

  it("keeps the language picked in the switch", () => {
    expect(rewrite(get(`/k/${en.link}`, { cookie: "preview_lang=de" }))).toBe(`http://localhost/de/k/${en.link}`);
  });

  it("takes the browser's language for a token that opens nothing", () => {
    expect(rewrite(get("/k/unknown", { "accept-language": "en" }))).toBe("http://localhost/en/k/unknown");
  });

  it("sets no cookie, keeps them out of search engines and their address out of other sites' Referer", () => {
    const r = get(`/k/${en.link}`);
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(r.headers.get("referrer-policy")).toBe("same-origin");
    expect(get("/").headers.get("x-robots-tag")).toBeNull();
  });
});
