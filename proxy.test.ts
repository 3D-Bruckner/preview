import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
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
    ])
      expect(runs(path), path).toBe(false);
    for (const path of ["/", "/customers", "/customers/abc", "/models/abc", "/signin?next=%2F", "/consent", "/settings", "/mcpx", "/healthy"])
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
