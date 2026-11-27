// The 3D view on a model's page: that it draws the model (and keeps a 3MF's colours), that its controls work (reset, the keyboard), that
// it holds still for a visitor who turned motion off, and that a file it can't read gives a message instead of an empty box. The view is
// judged by its pixels, taken from a screenshot of it (a WebGL canvas can't be read back after it has been shown). Headless Chromium draws
// WebGL in software. The data is seeded through the domain (e2e/seed.ts).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PHONE } from "./app";
import { customer, model, version } from "./seed";

test.use(PHONE);

/** A customer with one model of the given fixture; the model page's address. */
async function modelPage(threemf: string, title: string): Promise<string> {
  const c = customer(`Viewer ${Math.random().toString(36).slice(2, 6)}`);
  const m = model(c, title);
  await version(m, { threemf });
  return `/k/${c.link}/${m.id}`;
}

/** The view, once it has drawn the model. */
async function openView(page: Page, path: string, title: string): Promise<Locator> {
  await page.goto(path);
  const view = page.getByRole("img", { name: `3D-Ansicht von ${title}` });
  await expect(view).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  return view;
}

type Rgb = [number, number, number];
interface Look {
  /** The colour behind the model: the middle of the top edge, which the model never reaches. */
  background: Rgb;
  centre: Rgb;
  /** How many pixels are clearly red, and clearly blue. */
  red: number;
  blue: number;
  /** The view shrunk to 24×24 grey values: two looks are the same view when these are (nearly) equal. */
  thumb: number[];
}

/** What the view shows now, from a screenshot of it, read in the page. */
async function look(page: Page, view: Locator): Promise<Look> {
  const png = (await view.screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    const at = (x: number, y: number): [number, number, number] => {
      const d = g.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      return [d[0]!, d[1]!, d[2]!];
    };
    const all = g.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    let blue = 0;
    for (let i = 0; i < all.length; i += 4) {
      const [r, gr, b] = [all[i]!, all[i + 1]!, all[i + 2]!];
      if (r > gr + 60 && r > b + 60) red++;
      if (b > r + 60 && b > gr + 30) blue++;
    }
    const thumb: number[] = [];
    const s = document.createElement("canvas");
    s.width = s.height = 24;
    const sg = s.getContext("2d", { willReadFrequently: true })!;
    sg.drawImage(c, 0, 0, 24, 24);
    const sd = sg.getImageData(0, 0, 24, 24).data;
    for (let i = 0; i < sd.length; i += 4) thumb.push(Math.round((sd[i]! + sd[i + 1]! + sd[i + 2]!) / 3));
    return { background: at(c.width / 2, 6), centre: at(c.width / 2, c.height / 2), red, blue, thumb };
  }, png);
}

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The mean difference of two looks' thumbnails, in grey levels. */
const apart = (a: Look, b: Look) => a.thumb.reduce((sum, v, i) => sum + Math.abs(v - b.thumb[i]!), 0) / a.thumb.length;
/** Software WebGL draws slowly while the other workers run: a view that moves gets longer than the default to get there. */
const MOVING = { timeout: 20_000 };

test("the ramp is drawn in the middle of the view, on the background", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const view = await openView(page, await modelPage("ramp.3mf", "Rampe"), "Rampe");
  const seen = await look(page, view);
  expect(distance(seen.centre, seen.background)).toBeGreaterThan(20);
});

test("the keychain keeps the 3MF's colours: its red part and its blue part are both shown", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const view = await openView(page, await modelPage("keychain.3mf", "Schlüsselanhänger"), "Schlüsselanhänger");
  const seen = await look(page, view);
  expect(seen.red).toBeGreaterThan(50);
  expect(seen.blue).toBeGreaterThan(50);
});

test("the reset button brings a turned view back to where it started", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const view = await openView(page, await modelPage("keychain.3mf", "Schlüsselanhänger"), "Schlüsselanhänger");
  const start = await look(page, view);

  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => apart(await look(page, view), start), MOVING).toBeGreaterThan(3);

  await page.getByRole("button", { name: "Ansicht zurücksetzen" }).click();
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

test("the view turns slowly by itself, and holds still when the visitor turned motion off", async ({ page }) => {
  const path = await modelPage("keychain.3mf", "Schlüsselanhänger");
  const view = await openView(page, path, "Schlüsselanhänger");
  const first = await look(page, view);
  await expect.poll(async () => apart(await look(page, view), first), MOVING).toBeGreaterThan(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openView(page, path, "Schlüsselanhänger");
  const still = await look(page, view);
  await page.waitForTimeout(1500);
  expect(apart(await look(page, view), still)).toBeLessThan(0.5);
});

test("a file that can't be read gives a message instead of an empty view", async ({ page }) => {
  const path = await modelPage("ramp.3mf", "Rampe");
  await page.route("**/model.3mf", (route) => route.fulfill({ status: 200, contentType: "model/3mf", body: "not a zip" }));
  await page.goto(path);
  await expect(page.getByRole("alert").filter({ hasText: "Das Modell konnte nicht angezeigt werden" })).toBeVisible();
  await expect(page.getByRole("img", { name: "3D-Ansicht von Rampe" })).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("button", { name: "Ansicht zurücksetzen" })).toHaveCount(0);
});
