import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT, DEFAULT_BRAND_NAME, loadConfig, VARIABLES } from "./config";

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** The variable names a text mentions; a provider's own name (GITHUB in PREVIEW_OIDC_GITHUB_CLIENT_ID) counts as <NAME>. */
function named(text: string): string[] {
  const names = text.match(/\b(?:PREVIEW_(?:[A-Z0-9]|<NAME>)(?:[A-Z0-9_]|<NAME>)*|PUBLIC_URL|DATA_DIR|PORT|TZ|PUID|PGID|NODE_EXTRA_CA_CERTS)\b/g) ?? [];
  return [
    ...new Set(
      names
        .filter((n) => !n.endsWith("_"))
        .map((n) => n.replace(/^PREVIEW_OIDC_(?!<NAME>)[A-Z0-9]+_(CLIENT_ID|CLIENT_SECRET|ISSUER|LABEL)$/, "PREVIEW_OIDC_<NAME>_$1")),
    ),
  ].sort();
}

/**
 * The variables a source reads from process.env: `process.env.X`, `process.env["X"]` (either quote) and `const { X, Y: y, Z = … } =
 * process.env` (a rest element names none).
 */
function envReads(source: string): string[] {
  const dotted = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]!);
  const bracketed = [...source.matchAll(/process\.env\[\s*["'`]([A-Z0-9_]+)["'`]\s*\]/g)].map((m) => m[1]!);
  const destructured = [...source.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)].flatMap((m) =>
    m[1]!
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith("..."))
      .map((part) => /^["']?([A-Za-z0-9_]+)/.exec(part)?.[1] ?? ""),
  );
  return [...dotted, ...bracketed, ...destructured].filter(Boolean);
}

/** The app's own source files, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx|mjs)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.parentPath.includes("testing"))
    .map((e) => relative(ROOT, join(e.parentPath, e.name)));
}

const SECRET = "s".repeat(32);
const env = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  PUBLIC_URL: "https://preview.example.com",
  PREVIEW_SECRET: SECRET,
  ...extra,
});

describe("loadConfig", () => {
  it("refuses a secret shorter than 32 characters", () => {
    expect(() => loadConfig(env({ PREVIEW_SECRET: "short" }))).toThrow("PREVIEW_SECRET must be at least 32 characters");
  });

  it("refuses a missing secret with the same message", () => {
    expect(() => loadConfig(env({ PREVIEW_SECRET: undefined }))).toThrow("PREVIEW_SECRET must be at least 32 characters");
  });

  it("refuses a dev user in production", () => {
    expect(() => loadConfig(env({ NODE_ENV: "production", PREVIEW_DEV_USER: "dev@example.com" }))).toThrow("PREVIEW_DEV_USER is not allowed in production");
  });

  it("takes a dev user outside production", () => {
    expect(loadConfig(env({ PREVIEW_DEV_USER: "dev@example.com" })).devUser).toBe("dev@example.com");
  });

  it("parses the allowlist: trimmed, empty entries dropped", () => {
    expect(loadConfig(env({ PREVIEW_ALLOWED_EMAILS: " a@x.de, @y.de " })).allowedEmails).toEqual(["a@x.de", "@y.de"]);
    expect(loadConfig(env({ PREVIEW_ALLOWED_EMAILS: " , " })).allowedEmails).toEqual([]);
  });

  it("lets nobody in when the allowlist is unset", () => {
    expect(loadConfig(env()).allowedEmails).toEqual([]);
  });

  it("requires PUBLIC_URL as a URL and drops a trailing slash", () => {
    expect(() => loadConfig(env({ PUBLIC_URL: undefined }))).toThrow("PUBLIC_URL");
    expect(() => loadConfig(env({ PUBLIC_URL: "preview.example.com" }))).toThrow("PUBLIC_URL");
    expect(loadConfig(env({ PUBLIC_URL: "https://preview.example.com/" })).publicUrl).toBe("https://preview.example.com");
  });

  it("has the defaults: /data, 100 MB uploads, a neutral brand, no SMTP", () => {
    const c = loadConfig(env({ DATA_DIR: undefined }));
    expect(c).toMatchObject({ dataDir: "/data", maxUploadMb: 100 });
    expect(c.brand).toEqual({ name: "Preview", accentColor: DEFAULT_ACCENT });
    expect(c.smtpUrl).toBeUndefined();
    expect(c.smtpFrom).toBeUndefined();
    expect(c.devUser).toBeUndefined();
    expect(c.slicer).toBeUndefined();
  });

  it("takes the slicer: its URL, an optional token and the material for files that name none (PLA unless set)", () => {
    expect(loadConfig(env({ PREVIEW_SLICER_URL: "https://slicing.example.com/" })).slicer).toEqual({ url: "https://slicing.example.com", material: "PLA" });
    expect(loadConfig(env({ PREVIEW_SLICER_URL: "https://slicing.example.com", PREVIEW_SLICER_TOKEN: "t0k", PREVIEW_SLICER_MATERIAL: "petg" })).slicer).toEqual(
      { url: "https://slicing.example.com", token: "t0k", material: "PETG" },
    );
    expect(() => loadConfig(env({ PREVIEW_SLICER_URL: "https://s.example.com", PREVIEW_SLICER_MATERIAL: "ABS" }))).toThrow(
      "PREVIEW_SLICER_MATERIAL must be PLA or PETG",
    );
    expect(() => loadConfig(env({ PREVIEW_SLICER_URL: "slicing" }))).toThrow("PREVIEW_SLICER_URL must be an http(s) URL");
  });

  it("takes the address feedback is mailed to, and refuses one that isn't an address", () => {
    expect(loadConfig(env({})).feedbackEmail).toBeUndefined();
    expect(loadConfig(env({ PREVIEW_FEEDBACK_EMAIL: "feedback@example.com" })).feedbackEmail).toBe("feedback@example.com");
    expect(() => loadConfig(env({ PREVIEW_FEEDBACK_EMAIL: "feedback" }))).toThrow("PREVIEW_FEEDBACK_EMAIL must be one email address");
  });

  it("takes every setting from the environment", () => {
    const c = loadConfig(
      env({
        DATA_DIR: "/srv/preview",
        PREVIEW_SMTP_URL: "smtps://user:pw@mail.example.com:465",
        PREVIEW_SMTP_FROM: "Test Studio <noreply@example.com>",
        PREVIEW_MAX_UPLOAD_MB: "25",
        PREVIEW_BRAND_NAME: " Test Studio ",
        PREVIEW_BRAND_URL: "https://studio.example.com",
        PREVIEW_ACCENT_COLOR: "#0A7C5A",
        PREVIEW_LOGO: "brand/logo.svg",
        PREVIEW_IMPRINT_URL: "https://studio.example.com/imprint",
        PREVIEW_PRIVACY_URL: "https://studio.example.com/privacy",
      }),
    );
    expect(c).toEqual({
      publicUrl: "https://preview.example.com",
      dataDir: "/srv/preview",
      secret: SECRET,
      allowedEmails: [],
      smtpUrl: "smtps://user:pw@mail.example.com:465",
      smtpFrom: "Test Studio <noreply@example.com>",
      maxUploadMb: 25,
      brand: {
        name: "Test Studio",
        url: "https://studio.example.com",
        accentColor: "#0a7c5a",
        logo: "/srv/preview/brand/logo.svg",
        imprintUrl: "https://studio.example.com/imprint",
        privacyUrl: "https://studio.example.com/privacy",
      },
    });
  });

  it("refuses an upload limit that isn't a whole number of megabytes, at least 1", () => {
    for (const v of ["0", "-5", "2.5", "lots"]) expect(() => loadConfig(env({ PREVIEW_MAX_UPLOAD_MB: v })), v).toThrow("PREVIEW_MAX_UPLOAD_MB");
  });

  it("takes the accent colour as hex only, writing #rgb out", () => {
    expect(loadConfig(env({ PREVIEW_ACCENT_COLOR: "#F0a" })).brand.accentColor).toBe("#ff00aa");
    for (const v of ["blue", "#12345", "1d4ed8", "#1d4ed8ff", "rgb(0,0,255)", "#ggg"])
      expect(() => loadConfig(env({ PREVIEW_ACCENT_COLOR: v })), v).toThrow("PREVIEW_ACCENT_COLOR must be a hex colour");
  });

  it("takes the logo as an .svg or .png inside DATA_DIR, never outside it", () => {
    const at = (logo: string) => loadConfig(env({ DATA_DIR: "/srv/preview", PREVIEW_LOGO: logo })).brand.logo;
    expect(at("logo.png")).toBe("/srv/preview/logo.png");
    expect(at("/srv/preview/brand/logo.svg")).toBe("/srv/preview/brand/logo.svg");
    // A name that only starts with two dots is still inside.
    expect(at("..logo.svg")).toBe("/srv/preview/..logo.svg");
    for (const v of ["../logo.svg", "brand/../../etc/logo.png", "/etc/logo.svg", "/srv/preview-other/logo.svg", "logo.jpg", "logo.svg.exe"])
      expect(() => at(v), v).toThrow("PREVIEW_LOGO must be an .svg or .png file inside DATA_DIR");
  });

  it("refuses a brand, imprint or privacy link that isn't an http(s) URL", () => {
    for (const name of ["PREVIEW_BRAND_URL", "PREVIEW_IMPRINT_URL", "PREVIEW_PRIVACY_URL"])
      for (const v of ["studio.example.com", "javascript:alert(1)", "mailto:a@example.com"])
        expect(() => loadConfig(env({ [name]: v })), `${name}=${v}`).toThrow(`${name} must be an http(s) URL`);
  });

  it("refuses a brand name longer than 80 characters", () => {
    expect(() => loadConfig(env({ PREVIEW_BRAND_NAME: "x".repeat(81) }))).toThrow("PREVIEW_BRAND_NAME");
  });

  it("treats an empty value as unset", () => {
    const c = loadConfig(
      env({
        PREVIEW_SMTP_URL: "",
        PREVIEW_DEV_USER: "",
        PREVIEW_MAX_UPLOAD_MB: "",
        PREVIEW_BRAND_NAME: " ",
        PREVIEW_BRAND_URL: "",
        PREVIEW_ACCENT_COLOR: "",
        PREVIEW_LOGO: "",
        PREVIEW_IMPRINT_URL: "",
        PREVIEW_PRIVACY_URL: "",
      }),
    );
    expect(c.maxUploadMb).toBe(100);
    expect(c.smtpUrl).toBeUndefined();
    expect(c.devUser).toBeUndefined();
    expect(c.brand).toEqual({ name: "Preview", accentColor: DEFAULT_ACCENT });
  });

  it("names no operator in its defaults: the default accent passes WCAG AA against white", () => {
    expect(DEFAULT_BRAND_NAME).toBe("Preview");
    const channel = (i: number) => {
      const c = parseInt(DEFAULT_ACCENT.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("envReads: every way of reading a variable counts, dotted, bracketed and destructured", () => {
    const src = [
      "const a = process.env.PREVIEW_A;",
      "const b = process.env[\"PREVIEW_B\"] ?? process.env['PREVIEW_C'];",
      'const { PREVIEW_D, PREVIEW_E: e, PREVIEW_F = "x", ...rest } = process.env;',
      "const {\n  PREVIEW_G,\n} = process.env;",
    ].join("\n");
    expect(envReads(src).sort()).toEqual(["PREVIEW_A", "PREVIEW_B", "PREVIEW_C", "PREVIEW_D", "PREVIEW_E", "PREVIEW_F", "PREVIEW_G"]);
  });

  it("envExampleListsEveryVariable: .env.example and docs/configuration.md name exactly the variables the app reads", () => {
    const every = Object.keys(VARIABLES).sort();
    expect(named(read(".env.example"))).toEqual(every);
    expect(named(read("docs/configuration.md"))).toEqual(every);
    // And nothing reads one that isn't listed (Next.js's own and NODE_ENV aside).
    const files = [...sources("backend"), ...sources("app"), ...sources("components"), "proxy.ts", "instrumentation.ts", "docker-entrypoint.mjs", "Dockerfile"];
    const read_ = files.flatMap((f) => envReads(read(f)));
    const unlisted = [...new Set(read_)].filter((v) => !(v in VARIABLES) && !["NODE_ENV", "NEXT_RUNTIME", "NEXT_PHASE"].includes(v));
    expect(unlisted).toEqual([]);
  });
});
