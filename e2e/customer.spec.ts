// The customer pages: what a customer sees behind their link, and that nothing else is seen there (another customer's models, a file to
// download, a cookie, a search engine's index). The data is seeded through the domain (e2e/seed.ts).
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { renewLink, revokeLink } from "../backend/customers";
import { PHONE } from "./app";
import { customer, model, runtime, version } from "./seed";

test.use(PHONE);

/** A drawing file written for the test (an SVG with a script in it, to see that it never runs; a PDF). */
function drawing(name: string, content: string): string {
  const path = join(mkdtempSync(join(process.env.E2E_DATA_DIR!, "seed-")), name);
  writeFileSync(path, content);
  return path;
}
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><script>window.parent.svgRan = true</script><rect width="40" height="20"/></svg>';
const PDF = "%PDF-1.4\n%%EOF\n";

/** Two customers, each with a model of their own: A's has two versions, the newer with three drawings. */
async function seed() {
  const a = customer(`Anna ${Math.random().toString(36).slice(2, 6)}`);
  const b = customer("Bert");
  const ramp = model(a, "Rampe", "Für die Stufe vor der Tür");
  await version(ramp, { note: "Erster Entwurf" });
  await version(ramp, {
    note: "2 cm breiter",
    drawings: [join(process.cwd(), "backend", "fixtures", "preview.png"), drawing("d.svg", SVG), drawing("d.pdf", PDF)],
  });
  const keychain = model(b, "Schlüsselanhänger");
  await version(keychain, { threemf: "keychain.3mf" });
  return { a, b, ramp, keychain };
}

const NOT_FOUND_PATH = "/does-not-exist";

test("the overview counts each model's parts", async ({ page }) => {
  const c = customer(`Clara ${Math.random().toString(36).slice(2, 6)}`);
  await version(model(c, "Spulenhalter"), { threemf: "plates.3mf" });
  await version(model(c, "Rampe"));
  await page.goto(`/k/${c.link}`);
  await expect(page.getByRole("link", { name: /Spulenhalter/ })).toContainText("3 Teile");
  await expect(page.getByRole("link", { name: /Rampe/ })).toContainText("1 Teil");
});

/**
 * A page as a visitor gets it: its status, language, title and what its body shows (the header, main and footer as rendered; the
 * framework's own scripts and its dev tools left out, since their chunks differ by route).
 */
async function shown(page: Page, path: string) {
  const r = await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return {
    status: r?.status(),
    lang: await page.locator("html").getAttribute("lang"),
    title: await page.title(),
    body: await page.locator("body > header, body > main, body > footer").evaluateAll((els) => els.map((e) => e.outerHTML).join("")),
  };
}

/** A file's 404: its status, type and body. */
async function fileMiss(request: APIRequestContext, url: string) {
  const r = await request.get(url);
  return { status: r.status(), type: r.headers()["content-type"] ?? null, body: await r.text() };
}

/** Every response the page gets while `run` runs. */
async function responsesDuring(page: Page, run: () => Promise<unknown>) {
  const seen: { url: string; setCookie: string | null }[] = [];
  const on = (r: import("@playwright/test").Response) => void seen.push({ url: r.url(), setCookie: r.headers()["set-cookie"] ?? null });
  page.on("response", on);
  await run();
  page.off("response", on);
  return seen;
}

test("a customer's page shows their models as tiles with previews, loads no 3MF, offers no download and sets no cookie", async ({ page, context }) => {
  const { a, ramp } = await seed();
  const seen = await responsesDuring(page, async () => {
    const r = await page.goto(`/k/${a.link}`);
    expect(r?.status()).toBe(200);
    expect(r?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deine Modelle");
    await expect(page.getByText(`Für ${a.name}`)).toBeVisible();
    await expect(page.getByRole("main").getByRole("list").first()).toContainText("1 Modell");
    const tile = page.getByRole("link", { name: /Rampe/ });
    await expect(tile).toContainText("Version 2");
    await expect(tile).toContainText("Neue Version");
    await expect(tile).toContainText("Zuletzt: 2 cm breiter");
    await expect(tile).toHaveAttribute("href", `/k/${a.link}/${ramp.id}`);
    await expect.poll(() => tile.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  });
  expect(seen.filter((r) => r.url.endsWith(".3mf") || r.url.includes("/model.3mf"))).toEqual([]);
  expect(seen.filter((r) => r.setCookie)).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe("");
  expect(await context.cookies()).toEqual([]);
  await expect(page.locator("[download]")).toHaveCount(0);
  await expect(page.locator('a[href*="/files/"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("a model's page shows the newest version, the versions with their notes and the drawings, and no file to download", async ({ page, context }) => {
  const { a, ramp } = await seed();
  const seen = await responsesDuring(page, async () => {
    await page.goto(`/k/${a.link}`);
    await page.getByRole("link", { name: /Rampe/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rampe");
  });
  expect(seen.filter((r) => r.setCookie)).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  await expect(page.getByText("Für die Stufe vor der Tür")).toBeVisible();

  const viewer = page.getByRole("img", { name: "3D-Ansicht von Rampe" });
  await expect(viewer).toHaveAttribute("data-threemf", new RegExp(`^/k/${a.link}/files/[0-9a-f-]{36}/model\\.3mf$`));
  const versions = page.getByRole("region", { name: "Versionen" }).getByRole("listitem");
  await expect(versions).toHaveCount(2);
  await expect(versions.nth(0)).toContainText("Version 2");
  await expect(versions.nth(0)).toContainText("2 cm breiter");
  await expect(versions.nth(1)).toContainText("Erster Entwurf");

  // The drawings: the PNG and the SVG as pictures, the PDF the one link, opened by the browser's own viewer.
  const drawings = page.getByRole("region", { name: "Zeichnungen" });
  for (const name of ["Zeichnung 1", "Zeichnung 2"]) {
    const img = drawings.getByRole("img", { name });
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => (window as { svgRan?: boolean }).svgRan)).toBeUndefined();
  const pdf = drawings.getByRole("link", { name: "Zeichnung 3 (PDF)" });
  await expect(pdf).toHaveAttribute("href", /\.pdf$/);
  await expect(pdf).toHaveAttribute("target", "_blank");
  await expect(page.locator("[download]")).toHaveCount(0);
  // No link to the 3MF, the preview or a picture: the PDF drawing is the only file a link opens.
  expect(await page.locator('a[href*="/files/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!).filter((h) => !h.endsWith(".pdf")))).toEqual([]);

  // An older version stays selectable: its 3MF goes to the view, and it has no drawings.
  await versions.nth(1).getByRole("link").click();
  await expect(versions.nth(1).getByRole("link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "Zeichnungen" })).toHaveCount(0);
  const older = await viewer.getAttribute("data-threemf");
  expect(older).not.toBeNull();
  await page.goto(`/k/${a.link}/${ramp.id}`);
  expect(await viewer.getAttribute("data-threemf")).not.toBe(older);
});

test("the files are the customer's own, shown inline, sandboxed, private and not indexed", async ({ page, request }) => {
  const { a, b } = await seed();
  await page.goto(`/k/${a.link}`);
  await page.getByRole("link", { name: /Rampe/ }).click();
  const threemf = (await page.getByRole("img", { name: "3D-Ansicht von Rampe" }).getAttribute("data-threemf"))!;
  const svg = (await page.getByRole("img", { name: "Zeichnung 2" }).getAttribute("src"))!;
  const pdf = (await page.getByRole("link", { name: "Zeichnung 3 (PDF)" }).getAttribute("href"))!;
  // Every file is sandboxed but a PDF, which Chromium's PDF viewer wouldn't open sandboxed; none may be framed.
  const SANDBOXED = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox";
  const PDF_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'";
  for (const [url, type, csp] of [
    [threemf, "model/3mf", SANDBOXED],
    [svg, "image/svg+xml", SANDBOXED],
    [pdf, "application/pdf", PDF_CSP],
  ] as const) {
    const r = await request.get(url);
    expect(r.status(), url).toBe(200);
    expect(r.headers()).toMatchObject({
      "content-type": type,
      "content-disposition": "inline",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy": csp,
    });
    expect(r.headers()["set-cookie"]).toBeUndefined();
  }
  // B's link doesn't open A's file, and neither does a made-up one: each answers the same 404 as a file that is nowhere.
  const missing = await fileMiss(request, `/k/${"x".repeat(32)}/files/nothing/model.3mf`);
  expect(missing.status).toBe(404);
  for (const url of [threemf.replace(a.link!, b.link!), threemf.replace(a.link!, "x".repeat(32)), threemf.replace("model.3mf", "model.scad")])
    expect(await fileMiss(request, url), url).toEqual(missing);
});

test("an unknown, replaced or revoked link and another customer's model answer the same 404 as any missing page", async ({ page, request }) => {
  const { a, b, ramp, keychain } = await seed();
  const missing = await shown(page, NOT_FOUND_PATH);
  expect(missing).toMatchObject({ status: 404, lang: "de" });
  expect(missing.body).toContain("Nicht gefunden");
  const before = a.link!;
  const renewed = renewLink(runtime(), a.id);
  if (!renewed.ok) throw new Error(renewed.message);
  revokeLink(runtime(), b.id);
  for (const path of [
    "/k/" + "x".repeat(32),
    `/k/${renewed.value.link}/${keychain.id}`,
    `/k/${renewed.value.link}/no-such-model`,
    `/k/${before}`,
    `/k/${before}/${ramp.id}`,
    `/k/${b.link}`,
  ]) {
    expect(await shown(page, path), path).toEqual(missing);
    expect((await request.get(path)).headers()["x-robots-tag"], path).toBe("noindex, nofollow");
  }
  expect((await request.get(`/k/${renewed.value.link}/${ramp.id}`)).status()).toBe(200);
});

test("a customer whose language is English gets English, until the visitor switches; only the switch sets a cookie", async ({ page, context }) => {
  const anna = customer("Anne", "en");
  await version(model(anna, "Ramp"));
  await page.goto(`/k/${anna.link}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your models");
  await expect(page.getByText("For Anne")).toBeVisible();
  expect(await context.cookies()).toEqual([]);

  await page.getByRole("button", { name: "Deutsch" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deine Modelle");
  expect(new URL(page.url()).pathname).toBe(`/k/${anna.link}`);
  expect((await context.cookies()).map((c) => c.name)).toEqual(["preview_lang"]);
});

test("the theme switch sets dark for the visitor and keeps it; only the switch sets its cookie", async ({ page, context }) => {
  const c = customer("Dora");
  await version(model(c, "Rampe"));
  await page.goto(`/k/${c.link}`);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  await page.getByRole("button", { name: "Dunkel" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Dunkel" })).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).pathname).toBe(`/k/${c.link}`);
  expect((await context.cookies()).map((x) => x.name)).toEqual(["preview_theme"]);
  await page.getByRole("button", { name: "Auto" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
});

test("the customer pages show the instance's brand, its logo and its imprint, and name nobody else", async ({ page }) => {
  const { a } = await seed();
  await page.goto(`/k/${a.link}`);
  const header = page.getByRole("banner");
  await expect(header).toContainText("Test Studio");
  const logo = header.locator("img");
  await expect(logo).toHaveAttribute("src", "/brand/logo");
  await expect.poll(() => logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  await expect(page).toHaveTitle(/Test Studio/);
  expect(await page.content()).not.toMatch(/bruckner/i);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "https://studio.example.com/imprint");
  const r = await page.request.get("/brand/logo");
  expect(r.headers()).toMatchObject({ "content-type": "image/svg+xml", "x-content-type-options": "nosniff" });
  expect(r.headers()["content-security-policy"]).toBe("default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox");
});

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a model's page has a breadcrumb, a version picker, and the viewer beside a side panel", async ({ page }) => {
    const { a, ramp } = await seed();
    await page.goto(`/k/${a.link}/${ramp.id}`);
    const crumbs = page.getByRole("navigation", { name: "Pfad" });
    await expect(crumbs.getByRole("link", { name: "Deine Modelle" })).toHaveAttribute("href", `/k/${a.link}`);

    const picker = page.getByText("Version 2 ·", { exact: false }).first();
    await picker.click();
    const choices = page.getByRole("list", { name: "Versionen wählen" }).getByRole("link");
    await expect(choices).toHaveCount(2);
    await expect(choices.nth(0)).toHaveAttribute("aria-current", "page");
    await expect(choices.nth(1)).toHaveAttribute("href", `/k/${a.link}/${ramp.id}?v=1`);

    const viewer = await page.getByRole("img", { name: "3D-Ansicht von Rampe" }).boundingBox();
    const aside = await page.getByRole("complementary").boundingBox();
    expect(aside!.x).toBeGreaterThan(viewer!.x + viewer!.width - 1);
    await expect(page.getByRole("complementary").getByRole("region", { name: "Versionen" })).toContainText("angezeigt");
  });

  test("the header, the page and the footer share one left edge", async ({ page }) => {
    const { a } = await seed();
    await page.goto(`/k/${a.link}`);
    const left = async (sel: string) =>
      await page
        .locator(sel)
        .first()
        .evaluate((e) => e.getBoundingClientRect().left + parseFloat(getComputedStyle(e).paddingLeft));
    const main = await left("body > main");
    expect(await left("body > header > div")).toBe(main);
    expect(await left("body > footer > nav")).toBe(main);
  });
});
