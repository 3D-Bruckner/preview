// The 3D view on a model's page: that it draws the model (and keeps a 3MF's colours), that its controls work (reset, the keyboard), that
// it holds still for a visitor who turned motion off, and that a file it can't read gives a message instead of an empty box. The view is
// judged by its pixels, taken from a screenshot of it (a WebGL canvas can't be read back after it has been shown). Headless Chromium draws
// WebGL in software. The data is seeded through the domain (e2e/seed.ts).
import { expect, test } from "@playwright/test";
import { PHONE } from "./app";
import { apart, distance, look, MOVING, openView } from "./look";
import { customer, model, version } from "./seed";

test.use(PHONE);

/** A customer with one model of the given fixture; the model page's address. */
async function modelPage(threemf: string, title: string): Promise<string> {
  const c = customer(`Viewer ${Math.random().toString(36).slice(2, 6)}`);
  const m = model(c, title);
  await version(m, { threemf });
  return `/k/${c.link}/${m.id}`;
}

test("the ramp is drawn in the middle of the view, on the background", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const view = await openView(page, await modelPage("ramp.3mf", "Rampe"), "Rampe");
  const seen = await look(page, view);
  expect(distance(seen.centre, seen.background)).toBeGreaterThan(20);
});

test("around the model and its shadow the view is only the background: no edge of the ground or of the shadow's reach", async ({ page }) => {
  const view = await openView(page, await modelPage("ramp.3mf", "Rampe"), "Rampe");
  // Where the opening turn stops: the edge showed from there, not from the angle a visitor who turned motion off gets.
  await expect(view).toHaveAttribute("data-rotating", "false", { timeout: 6_000 });
  // A plain white stage instead of the grid, so anything the view draws there shows.
  await view.evaluate((el) => Object.assign(el.parentElement!.style, { background: "#fff" }));
  const png = (await view.screenshot()).toString("base64");
  const marked = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    [c.width, c.height] = [img.width, img.height];
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    // The outer 6 % left and right, below the reset button and above the stage's rounded corners: the model is centred and its shadow
    // stays well inside.
    const w = Math.floor(c.width * 0.06);
    const top = Math.ceil(c.height * 0.16);
    const bottom = Math.floor(c.height * 0.95);
    let n = 0;
    for (const x0 of [1, c.width - w - 1]) {
      const d = g.getImageData(x0, top, w, bottom - top).data;
      for (let i = 0; i < d.length; i += 4) if (Math.min(d[i]!, d[i + 1]!, d[i + 2]!) < 252) n++;
    }
    return n;
  }, png);
  expect(marked).toBe(0);
});

test("the keychain keeps the 3MF's colours: its red part and its blue part are both shown", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const view = await openView(page, await modelPage("keychain.3mf", "Schlüsselanhänger"), "Schlüsselanhänger");
  const seen = await look(page, view);
  expect(seen.red).toBeGreaterThan(50);
  expect(seen.blue).toBeGreaterThan(50);
});

test("Einpassen brings a turned view back to where it started", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const view = await openView(page, await modelPage("keychain.3mf", "Schlüsselanhänger"), "Schlüsselanhänger");
  const start = await look(page, view);

  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => apart(await look(page, view), start), MOVING).toBeGreaterThan(3);

  await page.getByRole("button", { name: "Einpassen" }).click();
  await expect.poll(async () => apart(await look(page, view), start), MOVING).toBeLessThan(0.5);
});

test("the view turns by keyboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const view = await openView(page, await modelPage("keychain.3mf", "Schlüsselanhänger"), "Schlüsselanhänger");
  const start = await look(page, view);
  await view.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => apart(await look(page, view), start), MOVING).toBeGreaterThan(3);
});

test("the view opens with a partial turn that stops by itself within 5 seconds, a touch stops it sooner, and it never turns for a visitor who turned motion off", async ({
  page,
}) => {
  const path = await modelPage("keychain.3mf", "Schlüsselanhänger");
  const view = await openView(page, path, "Schlüsselanhänger");
  await expect(view).toHaveAttribute("data-rotating", "true");
  const first = await look(page, view);
  await expect(view).toHaveAttribute("data-rotating", "false", { timeout: 6_000 });
  // It did turn (the view it stopped on is another), and now it holds still: the same pixel measure tells the two apart.
  const stopped = await look(page, view);
  expect(apart(stopped, first)).toBeGreaterThan(1);
  await page.waitForTimeout(1000);
  expect(apart(await look(page, view), stopped)).toBeLessThan(0.5);

  // A touch stops it at once.
  await openView(page, path, "Schlüsselanhänger");
  await expect(view).toHaveAttribute("data-rotating", "true");
  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(view).toHaveAttribute("data-rotating", "false", { timeout: 1_000 });
  await page.mouse.up();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openView(page, path, "Schlüsselanhänger");
  await expect(view).toHaveAttribute("data-rotating", "false");
});

test("another version's 3MF replaces the view: one canvas, the new file", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const c = customer(`Viewer ${Math.random().toString(36).slice(2, 6)}`);
  const m = model(c, "Rampe");
  await version(m, { threemf: "keychain.3mf", note: "Zweifarbig" });
  await version(m, { note: "Grau" });
  const view = await openView(page, `/k/${c.link}/${m.id}`, "Rampe");
  const newest = (await view.getAttribute("data-threemf"))!;
  expect((await look(page, view)).red).toBe(0);

  await page.getByText("Version 2 ·", { exact: false }).first().click();
  await page.getByRole("list", { name: "Versionen wählen" }).getByRole("link").nth(1).click();
  await expect(view).not.toHaveAttribute("data-threemf", newest);
  await expect(view).toHaveAttribute("data-state", "ready", MOVING);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect((await look(page, view)).red).toBeGreaterThan(50);
});

test("a download that stalls gives the message after 30 seconds instead of loading forever", async ({ page }) => {
  const path = await modelPage("ramp.3mf", "Rampe");
  // The 3MF is asked for and never answered; the page's clock is Playwright's, so the 30 seconds pass at once.
  await page.route("**/model.3mf", () => {});
  await page.clock.install();
  const asked = page.waitForRequest("**/model.3mf");
  await page.goto(path);
  await asked;
  const view = page.getByRole("img", { name: "3D-Ansicht von Rampe" });
  await page.clock.runFor(29_000);
  await expect(view).toHaveAttribute("data-state", "loading");
  await page.clock.runFor(2_000);
  await expect(view).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("alert").filter({ hasText: "Das Modell konnte nicht angezeigt werden" })).toBeVisible();
});

test("a file that can't be read gives a message instead of an empty view", async ({ page }) => {
  const path = await modelPage("ramp.3mf", "Rampe");
  await page.route("**/model.3mf", (route) => route.fulfill({ status: 200, contentType: "model/3mf", body: "not a zip" }));
  await page.goto(path);
  await expect(page.getByRole("alert").filter({ hasText: "Das Modell konnte nicht angezeigt werden" })).toBeVisible();
  await expect(page.getByRole("img", { name: "3D-Ansicht von Rampe" })).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("button", { name: "Ansicht zurücksetzen" })).toHaveCount(0);
});
