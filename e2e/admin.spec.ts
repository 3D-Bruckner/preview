// The admin pages: the person who runs the instance manages customers, their links, models and versions. Signed out, none opens.
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PHONE } from "./app";
import { customer, FIXTURE, model, version } from "./seed";
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

test("create a customer, copy its link, add a model with its first 3MF, upload a version, renew and revoke the link", async ({ page, request }) => {
  const name = unique("Anna");
  await signIn(page, "/");
  await page.getByRole("button", { name: "Neuer Kunde" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Notiz").fill("Stammkundin");
  await dialog.getByRole("button", { name: "Kunde anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Stammkundin")).toBeVisible();

  // The link is shown in full and the copy button puts it on the clipboard and says so.
  const link = page.getByRole("textbox", { name: "Link" });
  const first = await link.inputValue();
  expect(first).toMatch(/^http:\/\/localhost:3310\/k\/[A-Za-z0-9_-]{32}$/);
  await page.getByRole("button", { name: "Link kopieren" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link kopiert" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first);
  // Öffnen opens it in a new tab; WhatsApp and Mail carry a prepared text with the link.
  await expect(page.getByRole("link", { name: "Öffnen" })).toHaveAttribute("href", first);
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    `https://wa.me/?text=${encodeURIComponent(`Hallo ${name.split(" ")[0]}, hier kannst du dir deine Modelle ansehen: ${first}`)}`,
  );
  await expect(page.getByRole("link", { name: "Mail" })).toHaveAttribute("href", /^mailto:\?subject=Deine%20Modelle&body=/);

  // The customer's language is editable, behind the pencil.
  await page.getByRole("button", { name: "Kunde bearbeiten" }).click();
  await page.getByRole("dialog").getByLabel("Sprache der Kundenseite").selectOption("en");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Kunde bearbeiten" }).click();
  await expect(page.getByRole("dialog").getByLabel("Sprache der Kundenseite")).toHaveValue("en");
  await page.getByRole("dialog").getByRole("button", { name: "Abbrechen" }).click();
  // In their language now: the prepared text is English.
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /Hello/);

  // A model with its first version in one go: a Bambu project brings its own picture, and its file name proposes the title.
  await page.getByLabel("3MF-Datei").setInputFiles(FIXTURE("plates.3mf").path);
  await expect(page.getByLabel("Titel", { exact: true })).toHaveValue("plates");
  await page.getByLabel("Titel", { exact: true }).fill("Rampe");
  await page.getByLabel("Beschreibung").fill("Für die Stufe");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rampe" })).toBeVisible();
  const versions = page
    .getByRole("region", { name: /Versionen/ })
    .getByRole("list")
    .first()
    .locator("> li");
  await expect(versions).toHaveCount(1);
  await expect(versions.first().getByRole("img", { name: "Bild von Version 1" })).toBeVisible();
  await expect(versions.first()).toContainText("noch nicht angesehen");

  // The next version uploaded by hand, with its own picture and a note.
  await page.getByLabel("3MF-Datei").setInputFiles(FIXTURE("ramp.3mf").path);
  await page.getByLabel("Eigenes Bild (PNG, optional)").setInputFiles(FIXTURE("preview.png").path);
  await page.getByLabel("Was hat sich geändert").fill("2 cm breiter");
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Version 2 hochgeladen" })).toBeVisible();
  await expect(versions).toHaveCount(2);
  await expect(versions.first()).toContainText("2 cm breiter");

  // A refused upload says why, in words: a 3MF without a picture of its own needs one.
  await page.getByLabel("3MF-Datei").setInputFiles(FIXTURE("ramp.3mf").path);
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("kein eigenes Bild");

  // The title and description are edited behind the pencil.
  await page.getByRole("button", { name: "Titel und Beschreibung bearbeiten" }).click();
  await page.getByRole("dialog").getByLabel("Titel", { exact: true }).fill("Rampe groß");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rampe groß" })).toBeVisible();

  // The customer page lists the model with its newest version, and the customer's own page shows it.
  await page.getByRole("navigation", { name: "Brotkrumen" }).getByRole("link", { name }).click();
  await expect(page.getByRole("link", { name: /Rampe groß/ })).toContainText("Version 2");
  expect((await request.get(first)).status()).toBe(200);

  // Renewing asks first, and the old link then answers 404.
  await page.getByRole("button", { name: "Neuer Link" }).click();
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

test("the customer's look is recorded, the operator's own is not", async ({ page, browser }) => {
  const c = customer(unique("Schauer"));
  const m = model(c, "Rampe");
  await version(m, { note: "Erster Entwurf" });
  // The operator opens the customer's page and the model, signed in: nothing is recorded.
  await signIn(page, `/k/${c.link}/${m.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Rampe" })).toBeVisible();
  await page.goto(`/customers/${c.id}`);
  await expect(page.getByText(/hat den Link noch nicht geöffnet/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Rampe/ })).toContainText("noch nicht angesehen");

  // The customer, in a browser of their own.
  const theirs = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await theirs.goto(`/k/${c.link}/${m.id}`);
  await expect(theirs.getByRole("heading", { level: 1, name: "Rampe" })).toBeVisible();
  await theirs.close();

  await page.reload();
  await expect(page.getByText(/hat zuletzt heute, .* reingeschaut/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Rampe/ })).toContainText("angesehen heute");
  await page.goto(`/models/${m.id}`);
  await expect(page.getByText(/: heute, \d/).first()).toBeVisible();
});

test("an empty drawing file is left out of an upload and the others are kept", async ({ page }) => {
  const c = customer(unique("Leer"));
  const m = model(c, "Rampe");
  const empty = join(mkdtempSync(join(process.env.E2E_DATA_DIR!, "seed-")), "empty.png");
  writeFileSync(empty, "");
  await signIn(page, `/models/${m.id}`);
  await page.getByLabel("3MF-Datei").setInputFiles(FIXTURE("ramp.3mf").path);
  await page.getByLabel("Eigenes Bild (PNG, optional)").setInputFiles(FIXTURE("preview.png").path);
  await page.getByLabel(/^Zeichnungen/).setInputFiles([empty, FIXTURE("preview.png").path]);
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Version 1 hochgeladen" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Versionen/ })).toContainText("1 Zeichnung");
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
