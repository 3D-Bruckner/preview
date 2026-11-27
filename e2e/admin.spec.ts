// The admin pages: the person who runs the instance manages customers, their links, models and versions. Signed out, none opens.
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PHONE } from "./app";
import { customer, FIXTURE, model } from "./seed";
import { signIn } from "./signin";

test.use({ ...PHONE, permissions: ["clipboard-read", "clipboard-write"] });

const unique = (name: string) => `${name} ${Math.random().toString(36).slice(2, 6)}`;

test("signed out, every admin page goes to the sign-in page", async ({ page }) => {
  const c = customer(unique("Verschlossen"));
  const m = model(c, "Rampe");
  for (const path of ["/", `/customers/${c.id}`, `/models/${m.id}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin\?next=/);
  }
});

test("create a customer, copy its link, add a model, upload a version, renew and revoke the link", async ({ page, request }) => {
  const name = unique("Anna");
  await signIn(page, "/");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Notiz").fill("Stammkundin");
  await page.getByRole("button", { name: "Kunde anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  // The link is shown in full and the copy button puts it on the clipboard and says so.
  const link = page.getByRole("textbox", { name: "Link" });
  const first = await link.inputValue();
  expect(first).toMatch(/^http:\/\/localhost:3310\/k\/[A-Za-z0-9_-]{32}$/);
  await page.getByRole("button", { name: "Link kopieren" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link kopiert" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first);

  // The customer's language is editable.
  await page.getByLabel("Sprache der Kundenseite").selectOption("en");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Gespeichert" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Sprache der Kundenseite")).toHaveValue("en");

  // A model, then its first version uploaded by hand.
  await page.getByLabel("Titel", { exact: true }).fill("Rampe");
  await page.getByLabel("Beschreibung").fill("Für die Stufe");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rampe" })).toBeVisible();
  await expect(page.getByText("Noch keine Version.")).toBeVisible();
  await page.getByLabel("3MF-Datei").setInputFiles(FIXTURE("ramp.3mf").path);
  await page.getByLabel("Vorschaubild (PNG)").setInputFiles(FIXTURE("preview.png").path);
  await page.getByLabel("Was hat sich geändert").fill("Erster Entwurf");
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Version 1 hochgeladen" })).toBeVisible();
  const versions = page.getByRole("region", { name: "Versionen" }).getByRole("listitem");
  await expect(versions).toHaveCount(1);
  await expect(versions.first()).toContainText("Erster Entwurf");

  // A refused upload says why, in words.
  await page.getByLabel("3MF-Datei").setInputFiles(FIXTURE("not-a-3mf.3mf").path);
  await page.getByLabel("Vorschaubild (PNG)").setInputFiles(FIXTURE("preview.png").path);
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("3MF");

  // The customer page lists the model with its newest version, and the customer's own page shows it.
  await page.getByRole("link", { name: /Zurück zu/ }).click();
  await expect(page.getByRole("link", { name: /Rampe/ })).toContainText("Version 1");
  expect((await request.get(first)).status()).toBe(200);

  // Renewing asks first, and the old link then answers 404.
  await page.getByRole("button", { name: "Link erneuern" }).click();
  await expect(page.getByRole("dialog")).toContainText("Der alte Link funktioniert sofort nicht mehr");
  await page.getByRole("dialog").getByRole("button", { name: "Link erneuern" }).click();
  await expect(link).not.toHaveValue(first);
  const second = await link.inputValue();
  expect((await request.get(first)).status()).toBe(404);
  expect((await request.get(second)).status()).toBe(200);

  // Revoking asks first; then there is no link, and the link that was shown answers 404.
  await page.getByRole("button", { name: "Link widerrufen" }).click();
  await expect(page.getByRole("dialog")).toContainText("funktioniert sofort nicht mehr");
  await page.getByRole("dialog").getByRole("button", { name: "Link widerrufen" }).click();
  await expect(page.getByText(/^Kein Link\./)).toBeVisible();
  expect((await request.get(second)).status()).toBe(404);
  await page.goto("/");
  await expect(page.getByRole("link", { name })).toContainText("Kein Link");
});

test("an empty drawing file is left out of an upload and the others are kept", async ({ page }) => {
  const c = customer(unique("Leer"));
  const m = model(c, "Rampe");
  const empty = join(mkdtempSync(join(process.env.E2E_DATA_DIR!, "seed-")), "empty.png");
  writeFileSync(empty, "");
  await signIn(page, `/models/${m.id}`);
  await page.getByLabel("3MF-Datei").setInputFiles(FIXTURE("ramp.3mf").path);
  await page.getByLabel("Vorschaubild (PNG)").setInputFiles(FIXTURE("preview.png").path);
  await page.getByLabel(/^Zeichnungen/).setInputFiles([empty, FIXTURE("preview.png").path]);
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Version 1 hochgeladen" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Versionen" }).getByRole("listitem")).toContainText("1 Zeichnung");
});

test("signed out, an admin page's redirect does not carry the customer's name or the model's title", async ({ request }) => {
  const c = customer(unique("Geheimkunde"));
  const m = model(c, unique("Geheimmodell"));
  const pages: [string, string][] = [
    [`/customers/${c.id}`, c.name],
    [`/models/${m.id}`, m.title],
  ];
  for (const [path, secret] of pages) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(await res.text()).not.toContain(secret);
  }
});
