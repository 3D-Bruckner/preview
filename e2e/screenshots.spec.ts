// The README's screenshot of a customer's model page, taken again by hand when the page changes: SCREENSHOTS=1 npx playwright test
// e2e/screenshots.spec.ts. Skipped in every other run. Desktop, light theme, still view, the whole page; Next's dev badge is taken out
// of the picture. Run it alone: it makes filaments, which every other customer page would offer while it runs.
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PHONE } from "./app";
import { clearFilaments, customer, filament, model, version } from "./seed";

test.use(PHONE);
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to take the README's screenshots");

test("the customer's model page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  const c = customer("Anna Beispiel");
  const m = model(c, "Schreibtisch-Organizer", "Ablage, Stifte- und Kartenhalter für den Schreibtisch");
  await version(m, { threemf: "showcase.3mf", note: "Erster Entwurf" });
  await version(m, { threemf: "showcase.3mf", note: "Kartenhalter 4 mm höher, Clip jetzt in Grün" });
  // The operator's filaments: the file's three by name, and one more to pick.
  filament("Bambu Schwarz", "PLA", "#1d1e21");
  filament("Bambu Grün", "PLA", "#00ae42");
  filament("Jade-Weiß", "PLA", "#f7f7f5");
  filament("Signalrot", "PLA", "#d62828");
  await page.goto(`/k/${c.link}/${m.id}`);
  await expect(page.getByRole("img", { name: "3D-Ansicht von Schreibtisch-Organizer" })).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await page.getByLabel("Farbe für Clip").selectOption({ label: "Signalrot (PLA)" });
  await page
    .getByRole("region", { name: /Rückmeldung/ })
    .getByLabel("Kommentar")
    .fill("Den Clip bitte in Rot, sonst passt alles.");
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.screenshot({ path: join(process.cwd(), "docs/images/customer-model-page.png"), fullPage: true });
  clearFilaments();
});
