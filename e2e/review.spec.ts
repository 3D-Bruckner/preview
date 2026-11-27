// The model page as a review: the parts of the version's 3MF listed with their filament, shown alone (focus), hidden (the eye) and
// highlighted, the measurements of what is shown, and the view's tools. plates.3mf is a Bambu-style project: Halter (a 20 mm box), Spule
// split into two parts by filament (10 mm boxes; a third box is a modifier, neither listed nor drawn).
import { expect, test, type Page } from "@playwright/test";
import { PHONE } from "./app";
import { customer, model, version } from "./seed";

test.use(PHONE);

async function open(page: Page, threemf: string, title: string) {
  const c = customer(`Prüfer ${Math.random().toString(36).slice(2, 6)}`);
  const m = model(c, title);
  await version(m, { threemf });
  await page.goto(`/k/${c.link}/${m.id}`);
  await expect(page.getByRole("img", { name: `3D-Ansicht von ${title}` })).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
}

const dims = (page: Page) => page.getByRole("region", { name: /Maße/ });
const parts = (page: Page) => page.getByRole("region", { name: /Teile/ });
async function measured(page: Page) {
  return dims(page).locator("dd").allInnerTexts();
}

test("lists the parts with their filament; focus, the eye and the measurements follow each other", async ({ page }) => {
  await open(page, "plates.3mf", "Spulenhalter");
  const rows = parts(page).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Halter");
  await expect(rows.nth(0)).toContainText("PLA · #00ae42");
  await expect(rows.nth(1)).toContainText("Spule 1");
  await expect(rows.nth(1)).toContainText("PETG · #ffffff");
  await expect(rows.nth(2)).toContainText("Spule 2");
  await expect(dims(page)).toContainText("ganzes Modell");
  expect(await measured(page)).toEqual(["322 mm", "20 mm", "20 mm"]);

  const eye = page.getByRole("button", { name: "Halter ein- oder ausblenden" });
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await eye.click();
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => measured(page)).toEqual(["22 mm", "10 mm", "10 mm"]);

  const focus = page.getByRole("button", { name: "Nur Spule 1 zeigen" });
  await focus.click();
  await expect(focus).toHaveAttribute("aria-pressed", "true");
  await expect(dims(page).getByRole("heading")).toContainText("Spule 1");
  await expect.poll(() => measured(page)).toEqual(["10 mm", "10 mm", "10 mm"]);
  await focus.click();
  await expect(focus).toHaveAttribute("aria-pressed", "false");
  await expect(dims(page)).toContainText("ganzes Modell");
});

test("the view's tools: four directions, the grid and fit", async ({ page }) => {
  await open(page, "plates.3mf", "Spulenhalter");
  const views = page.getByRole("group", { name: "Ansicht" });
  await expect(views.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");
  await views.getByRole("button", { name: "Oben" }).click();
  await expect(views.getByRole("button", { name: "Oben" })).toHaveAttribute("aria-pressed", "true");
  await expect(views.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Einpassen" }).click();
  await expect(views.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");

  const grid = page.getByRole("button", { name: "Raster" });
  const stage = page.locator("[data-stage]");
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  expect(await stage.evaluate((el) => getComputedStyle(el).backgroundImage)).not.toBe("none");
  await grid.click();
  await expect(grid).toHaveAttribute("aria-pressed", "false");
  expect(await stage.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
});

test("on a desktop, the measurements chip over the view says the whole model's size", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "ramp.3mf", "Rampe");
  await expect(page.getByTestId("size-chip")).toHaveText("20 × 20 × 20 mm");
});

test("another version starts the review over: the whole model, nothing hidden", async ({ page }) => {
  const c = customer(`Prüfer ${Math.random().toString(36).slice(2, 6)}`);
  const m = model(c, "Spulenhalter");
  await version(m, { threemf: "ramp.3mf", note: "Rampe" });
  await version(m, { threemf: "plates.3mf", note: "Spule" });
  await page.goto(`/k/${c.link}/${m.id}`);
  const view = page.getByRole("img", { name: "3D-Ansicht von Spulenhalter" });
  await expect(view).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await page.getByRole("button", { name: "Nur Spule 1 zeigen" }).click();
  await expect.poll(() => measured(page)).toEqual(["10 mm", "10 mm", "10 mm"]);

  const newest = (await view.getAttribute("data-threemf"))!;
  await page
    .getByRole("region", { name: "Versionen" })
    .getByRole("link", { name: /Version 1/ })
    .click();
  await expect(view).not.toHaveAttribute("data-threemf", newest);
  await expect(view).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await expect(dims(page)).toContainText("ganzes Modell");
  await expect.poll(() => measured(page)).toEqual(["20 mm", "20 mm", "20 mm"]);
});
