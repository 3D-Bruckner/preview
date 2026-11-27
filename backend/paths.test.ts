import { describe, expect, it } from "vitest";
import { isInside } from "./paths";

describe("isInside", () => {
  it("is true for a path below the root, a name that only starts with two dots included", () => {
    expect(isInside("/srv/data", "/srv/data/logo.svg")).toBe(true);
    expect(isInside("/srv/data", "/srv/data/brand/logo.png")).toBe(true);
    expect(isInside("/srv/data", "/srv/data/..logo.svg")).toBe(true);
  });

  it("is false for the root itself, a way out of it and an absolute path elsewhere", () => {
    expect(isInside("/srv/data", "/srv/data")).toBe(false);
    expect(isInside("/srv/data", "/srv/data/../x")).toBe(false);
    expect(isInside("/srv/data", "/srv/x")).toBe(false);
    expect(isInside("/srv/data", "/srv/data-other/logo.svg")).toBe(false);
    expect(isInside("/srv/data", "/etc/passwd")).toBe(false);
  });
});
