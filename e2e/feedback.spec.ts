// The operator's filaments and the customer's feedback. Filaments are one list for the whole instance, so every test that makes them is
// in this one file, run in order, and leaves the list as it found it (empty).
import { expect, test, type Page } from "@playwright/test";
import { PHONE } from "./app";
import { everyControlByKeyboard, noViolations } from "./axe";
import { look, MOVING, openView } from "./look";
import { clearFilaments, customer, feedback, filament, model, version } from "./seed";
import { signIn } from "./signin";

test.use(PHONE);

test.describe.configure({ mode: "serial" });
test.afterEach(() => clearFilaments());

const id = () => Math.random().toString(36).slice(2, 8);

/** A customer with the two-part Spulenhalter (plates.3mf: Halter green, Spule white); their page, open and drawn. */
async function spulenhalter(page: Page) {
  const c = customer(`Rückmeldung ${id()}`);
  const m = model(c, "Spulenhalter");
  await version(m, { threemf: "plates.3mf" });
  const view = await openView(page, `/k/${c.link}/${m.id}`, "Spulenhalter");
  return { c, m, view, card: page.getByRole("region", { name: "Rückmeldung" }) };
}

test("the settings keep the filaments: add one, stop offering it, delete it", async ({ page }) => {
  await signIn(page, "/settings");
  const section = page.getByRole("region", { name: "Filamente" });
  await expect(section).toContainText("Noch keine Filamente.");
  await section.getByLabel("Name", { exact: true }).fill("Bambu Grün");
  await section.getByLabel("Material", { exact: true }).fill("PLA");
  await section.getByLabel("Farbe", { exact: true }).fill("#00ae42");
  await section.getByRole("button", { name: "Filament hinzufügen" }).click();
  const row = section.getByRole("listitem").filter({ hasText: "Bambu Grün" });
  await expect(row).toContainText("PLA · #00ae42");

  await row.getByText("Bearbeiten").click();
  await row.getByLabel("Wird angeboten").uncheck();
  await row.getByRole("button", { name: "Speichern" }).click();
  await expect(row).toContainText("nicht angeboten");

  await row.getByRole("button", { name: "Bambu Grün löschen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click();
  await expect(section).toContainText("Noch keine Filamente.");
});

test("without filaments there are no pickers; a comment alone is sent and shown under the version", async ({ page }) => {
  const { card } = await spulenhalter(page);
  await expect(page.getByRole("region", { name: /Teile/ }).getByRole("combobox")).toHaveCount(0);
  await card.getByLabel("Kommentar").fill("Bitte die Wand 2 mm dicker.");
  await card.getByRole("button", { name: "Rückmeldung senden" }).click();
  await expect(card.getByRole("status")).toContainText("Danke");
  await expect(card).toContainText(/Deine Rückmeldung vom \d\d\.\d\d\.\d{4}/);
  await expect(card).toContainText("Bitte die Wand 2 mm dicker.");
  await expect(card.getByLabel("Kommentar")).toHaveValue("");
});

test("picking a filament recolours the part, lists the wish, and sends it", async ({ page }) => {
  filament("Signalrot", "PLA", "#d62828");
  filament("Nicht da", "PLA", "#0000ff", false);
  const { card, view } = await spulenhalter(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const before = await look(page, view);
  const picker = page.getByLabel("Farbe für Halter");
  await expect(picker.getByRole("option")).toHaveText(["wie im Entwurf", "Signalrot (PLA)"]);
  await picker.selectOption({ label: "Signalrot (PLA)" });
  await expect.poll(async () => (await look(page, view)).red, MOVING).toBeGreaterThan(before.red + 150);
  await expect(card).toContainText("Halter: Signalrot");
  await card.getByRole("button", { name: "Rückmeldung senden" }).click();
  await expect(card.getByRole("status")).toContainText("Danke");
  await expect(card).toContainText(/Deine Rückmeldung vom/);
  await expect(card.getByRole("list", { name: "Deine Farbwünsche" }).last()).toContainText("Halter: Signalrot");
  // The picks stay after sending; back to the file's colour takes the wish away.
  await expect(card.getByRole("list", { name: "Gewählte Farben" })).toContainText("Halter: Signalrot");
  await picker.selectOption({ label: "wie im Entwurf" });
  await expect(card.getByRole("list", { name: "Gewählte Farben" })).toHaveCount(0);
  await expect.poll(async () => (await look(page, view)).red, MOVING).toBeLessThan(before.red + 50);
});

test("the 11th feedback within an hour is refused in German, and nothing is lost", async ({ page }) => {
  const { c, m, card } = await spulenhalter(page);
  for (let i = 0; i < 10; i++) await feedback(c, m, 1, `Nummer ${i + 1}`);
  await card.getByLabel("Kommentar").fill("Noch eine.");
  await card.getByRole("button", { name: "Rückmeldung senden" }).click();
  await expect(card.getByRole("alert")).toContainText("schon viele Rückmeldungen");
  await expect(card.getByLabel("Kommentar")).toHaveValue("Noch eine.");
});

test("a model page with pickers and feedback has no accessibility problems, and every control is reached by keyboard", async ({ page }) => {
  filament("Signalrot", "PLA", "#d62828");
  const { c, m, card } = await spulenhalter(page);
  await feedback(c, m, 1, "Etwas dicker, bitte.");
  await page.reload();
  await page.getByLabel("Farbe für Halter").selectOption({ label: "Signalrot (PLA)" });
  await expect(card).toContainText("Deine Rückmeldung vom");
  await noViolations(page);
  await everyControlByKeyboard(page);
});

test("the web app shows new feedback on the start page and under its version, and marks it seen once shown", async ({ page }) => {
  filament("Signalrot", "PLA", "#d62828");
  const c = customer(`Rückmeldung ${id()}`);
  const title = `Spulenhalter ${id()}`;
  const m = model(c, title);
  await version(m, { threemf: "plates.3mf" });
  await feedback(c, m, 1, "Bitte die Wand 2 mm dicker.");

  await signIn(page, "/");
  const fresh = page.getByRole("region", { name: /Neue Rückmeldungen/ });
  await expect(fresh).toBeVisible();
  await fresh.getByRole("link", { name: new RegExp(title) }).click();

  const versions = page.getByRole("region", { name: "Versionen" });
  await expect(versions).toContainText(`Rückmeldung von ${c.name}`);
  await expect(versions).toContainText("Bitte die Wand 2 mm dicker.");
  await expect(versions).toContainText("neu");

  await page.reload();
  await expect(versions).toContainText("Bitte die Wand 2 mm dicker.");
  await expect(versions.getByText("neu", { exact: true })).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
});
