import { describe, expect, it } from "vitest";
import { isTheme, THEME_COOKIE, THEMES, themeOf } from "./theme";

describe("themeOf", () => {
  it("keeps a known theme", () => {
    expect(themeOf("dark")).toBe("dark");
    expect(themeOf("light")).toBe("light");
  });
  it("treats anything else as auto", () => {
    expect(themeOf("neon")).toBe("auto");
    expect(themeOf(undefined)).toBe("auto");
  });
  it("names the three themes and the cookie", () => {
    expect(THEMES).toEqual(["auto", "light", "dark"]);
    expect(THEME_COOKIE).toBe("preview_theme");
    expect(isTheme("auto")).toBe(true);
    expect(isTheme(3)).toBe(false);
  });
});
