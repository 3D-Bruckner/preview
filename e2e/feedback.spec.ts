// The operator's filaments and the customer's feedback. Filaments are one list for the whole instance, so every test that makes them is
// in this one file, run in order, and leaves the list as it found it (empty).
import { expect, test } from "@playwright/test";
import { PHONE } from "./app";
import { signIn } from "./signin";

test.use(PHONE);

test.describe.configure({ mode: "serial" });

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
