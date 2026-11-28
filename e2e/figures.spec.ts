// The print figures: read from a 3MF Bambu Studio sliced, asked of the slicing service (e2e/fake-slicer.mjs) for any other, and what the
// operator can do when the service refused one.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { strToU8, unzipSync, zipSync } from "fflate";
import { PHONE } from "./app";
import { customer, model, version } from "./seed";
import { signIn } from "./signin";

test.use(PHONE);

/** ramp.3mf with a marker entry the fake slicer acts on; its path. */
function marked(marker: string): string {
  const entries = unzipSync(new Uint8Array(readFileSync(join(process.cwd(), "backend", "fixtures", "ramp.3mf"))));
  entries[`Metadata/${marker}`] = strToU8("e2e");
  const path = join(mkdtempSync(join(tmpdir(), "preview-e2e-3mf-")), "model.3mf");
  writeFileSync(path, zipSync(entries));
  return path;
}

const print = (page: Page) => page.getByRole("region", { name: /Druck/ });
const id = () => Math.random().toString(36).slice(2, 8);

async function open(page: Page, threemf: string) {
  const c = customer(`Druck ${id()}`);
  const m = model(c, "Spulenhalter");
  await version(m, { threemf });
  await page.goto(`/k/${c.link}/${m.id}`);
  return m;
}

test("a sliced Bambu project shows its own figures: time, weight and each filament", async ({ page }) => {
  await open(page, "plates.3mf");
  await expect(print(page)).toContainText("1 h 30 min");
  await expect(print(page)).toContainText("29,8 g");
  const rows = print(page).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("PLA · #00ae42");
  await expect(rows.nth(0)).toContainText("23,8 g");
  await expect(rows.nth(1)).toContainText("PETG · #ffffff");
  await expect(rows.nth(1)).toContainText("6 g");
});

test("a file without figures says they are being worked out, and shows the slicer's once it answers", async ({ page }) => {
  await open(page, marked(`e2e-busy-${id()}`));
  await expect(print(page)).toContainText("wird berechnet");

  await open(page, "ramp.3mf");
  await expect(print(page)).toContainText("42 min", { timeout: 30_000 });
  await expect(print(page)).toContainText("12,5 g");
});

test("the web app shows a refused slicing and Neu berechnen asks again", async ({ page }) => {
  const m = await open(page, marked(`e2e-refuse-once-${id()}`));
  await signIn(page, `/models/${m.id}`);
  const versions = page.getByRole("region", { name: "Versionen" });
  await expect(async () => {
    await page.reload();
    await expect(versions).toContainText("passt nicht auf die Druckplatte", { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Neu berechnen" }).click();
  await expect(async () => {
    await page.reload();
    await expect(versions).toContainText("42 min", { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(versions).toContainText("Slicer");
});
