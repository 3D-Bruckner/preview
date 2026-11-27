import { expect, test } from "@playwright/test";
import { signIn } from "./signin";

test("the health check answers ok", async ({ request }) => {
  const r = await request.get("/health");
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ status: "ok" });
});

test.describe("a browser that asks for German", () => {
  test.use({ locale: "de-DE", extraHTTPHeaders: { "accept-language": "de-DE,de;q=0.9,en;q=0.8" } });

  test("gets the pages in German, with no language in the URL", async ({ page }) => {
    await signIn(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("heading", { name: "Kunden" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("switches to English, and the choice sticks", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(new URL(page.url()).pathname).toBe("/");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  });

  test("gets a 404 in German at an address nothing answers", async ({ page }) => {
    const r = await page.goto("/no-such-page");
    expect(r?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
  });
});

test.describe("a browser that asks only for languages the UI doesn't speak", () => {
  test.use({ locale: "fr-FR", extraHTTPHeaders: { "accept-language": "fr-FR,fr;q=0.9" } });

  test("gets German, the default", async ({ page }) => {
    await signIn(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("heading", { name: "Kunden" })).toBeVisible();
  });
});

test("names no operator: the header and the title show the instance's brand (its settings), the footer its imprint", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("banner")).toContainText("Test Studio");
  await expect(page).toHaveTitle(/Test Studio/);
  expect(await page.content()).not.toMatch(/bruckner/i);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Imprint" })).toHaveAttribute("href", "https://studio.example.com/imprint");
  // No privacy link is set on the test server, so there is none.
  await expect(page.getByRole("contentinfo").getByRole("link")).toHaveCount(1);
});
