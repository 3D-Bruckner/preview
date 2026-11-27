import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { testRuntime } from "@/backend/testing/runtime";
import CustomerLayout from "./layout";

const current = vi.hoisted(() => ({ rt: undefined as unknown }));
vi.mock("@/app/_lib/runtime", () => ({ runtime: () => current.rt }));
vi.mock("@/app/_lib/theme", () => ({ currentTheme: async () => "dark" }));

async function header(dataDir: string, logo: string): Promise<string> {
  const rt = testRuntime({ DATA_DIR: dataDir, PREVIEW_LOGO: logo });
  current.rt = rt;
  try {
    return renderToStaticMarkup(await CustomerLayout({ children: null, params: Promise.resolve({ lang: "de" }) } as never));
  } finally {
    rt.store.close();
  }
}

describe("the customer layout's logo", () => {
  it("shows no image when PREVIEW_LOGO names a file that is not there (the logo route would refuse it)", async () => {
    const dir = mkdtempSync(join(process.env.DATA_DIR!, "logo-"));
    expect(await header(dir, "missing.svg")).not.toContain("<img");
  });

  it("shows the logo when the file is there", async () => {
    const dir = mkdtempSync(join(process.env.DATA_DIR!, "logo-"));
    writeFileSync(join(dir, "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect(await header(dir, "logo.svg")).toContain('<img src="/brand/logo"');
  });
});

describe("the customer layout's header", () => {
  it("has the theme switch beside the language switch, in the wide container", async () => {
    const html = await header(mkdtempSync(join(process.env.DATA_DIR!, "logo-")), "missing.svg");
    expect(html).toContain('action="/api/theme"');
    expect(html).toContain('action="/api/language"');
    expect(html).toContain("max-w-[1240px]");
    expect(html).toMatch(/value="dark"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*value="dark"/);
  });
});
