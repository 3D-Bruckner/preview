import { describe, expect, it } from "vitest";
import { formatMm, isRecent } from "./format";

describe("isRecent", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  it("is true within 7 days", () => {
    expect(isRecent("2026-11-21T10:00:00Z", now)).toBe(true);
  });
  it("is false just over 7 days", () => {
    expect(isRecent("2026-11-20T09:59:00Z", now)).toBe(false);
  });
});

describe("formatMm", () => {
  it("writes whole millimetres from 10 mm, one decimal below, in the page's language", () => {
    expect(formatMm(12.34, "de")).toBe("12");
    expect(formatMm(4.25, "de")).toBe("4,3");
    expect(formatMm(4.25, "en")).toBe("4.3");
    expect(formatMm(1234.4, "de")).toBe("1234");
    expect(formatMm(0, "de")).toBe("0");
  });
});
