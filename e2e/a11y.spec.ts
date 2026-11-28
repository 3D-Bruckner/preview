// Accessibility (conventions: code/accessibility): axe finds nothing on the main pages, and every control is reached with the keyboard.
import { expect, test } from "@playwright/test";
import { everyControlByKeyboard, noViolations } from "./axe";
import { PHONE } from "./app";
import { customer, model, version } from "./seed";
import { signIn } from "./signin";

test.use(PHONE);

test("a11y: the start page", async ({ page }) => {
  await signIn(page, "/");
  await expect(page.getByRole("heading", { level: 1, name: "Kunden" })).toBeVisible();
  await noViolations(page);
  await everyControlByKeyboard(page);
});

test("a11y: the sign-in page", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toBeVisible();
  await noViolations(page);
  await everyControlByKeyboard(page);
});

for (const [path, heading] of [["/settings", "Einstellungen"]]) {
  test(`a11y: ${path}`, async ({ page }) => {
    await signIn(page, path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await noViolations(page);
    await everyControlByKeyboard(page);
  });
}

test("a11y: a customer's admin page and a model's admin page", async ({ page }) => {
  const c = customer("Verwaltet");
  const m = model(c, "Rampe", "Für die Stufe");
  await version(m, { note: "Erster Entwurf" });
  for (const [path, heading] of [
    [`/customers/${c.id}`, "Verwaltet"],
    [`/models/${m.id}`, "Rampe"],
  ] as const) {
    await signIn(page, path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await noViolations(page);
    await everyControlByKeyboard(page);
  }
});

test("a11y: a customer's page and a model's page", async ({ page }) => {
  const c = customer("Barrierefrei");
  const m = model(c, "Rampe", "Für die Stufe");
  await version(m, { note: "Erster Entwurf" });
  await version(m, { note: "Breiter", drawings: [`${process.cwd()}/backend/fixtures/preview.png`] });
  for (const [path, heading] of [
    [`/k/${c.link}`, "Deine Modelle"],
    [`/k/${c.link}/${m.id}`, "Rampe"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await noViolations(page);
    await everyControlByKeyboard(page);
  }
});

test("a11y: a model's page with its parts listed", async ({ page }) => {
  const c = customer("Teile");
  const m = model(c, "Spulenhalter");
  await version(m, { threemf: "plates.3mf" });
  await page.goto(`/k/${c.link}/${m.id}`);
  await expect(page.getByRole("img", { name: "3D-Ansicht von Spulenhalter" })).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await noViolations(page);
  await everyControlByKeyboard(page);
});
