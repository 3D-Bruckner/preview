// Accessibility (conventions: code/accessibility): axe finds nothing on the main pages, and every control is reached with the keyboard.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PHONE } from "./app";
import { customer, model, version } from "./seed";
import { signIn } from "./signin";

test.use(PHONE);

async function noViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/**
 * Tabs through the page and checks that every visible, enabled control got the focus once. A tab list's other tabs are left out: the
 * ARIA tab pattern reaches them with the arrow keys, not Tab.
 */
async function everyControlByKeyboard(page: Page) {
  const total = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex='0']")];
    const visible = controls.filter(
      (el) => el.checkVisibility({ visibilityProperty: true }) && el.getClientRects().length > 0 && !(el.role === "tab" && el.tabIndex === -1),
    );
    visible.forEach((el, i) => el.setAttribute("data-control", String(i)));
    return visible.length;
  });
  const seen = new Set<string>();
  await page.locator("body").focus();
  for (let i = 0; i < total * 2 + 5; i++) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate(() => document.activeElement?.getAttribute("data-control") ?? null);
    if (at !== null) seen.add(at);
  }
  const missed = await page.evaluate(
    (seen) =>
      [...document.querySelectorAll<HTMLElement>("[data-control]")].filter((el) => !seen.includes(el.dataset.control!)).map((el) => el.outerHTML.slice(0, 120)),
    [...seen],
  );
  expect(missed).toEqual([]);
}

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
