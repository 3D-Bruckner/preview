import { describe, expect, it } from "vitest";
import { formatGrams, formatMm, hoursMinutes, isRecent } from "./format";

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

describe("formatGrams", () => {
  it("writes one decimal below 100 g (none when whole), whole grams from 100", () => {
    expect(formatGrams(29.75, "de")).toBe("29,8");
    expect(formatGrams(6, "de")).toBe("6");
    expect(formatGrams(12.5, "en")).toBe("12.5");
    expect(formatGrams(1234.4, "de")).toBe("1234");
  });
});

describe("hoursMinutes", () => {
  it("splits seconds into whole hours and minutes, at least a minute", () => {
    expect(hoursMinutes(5400)).toEqual({ h: 1, m: 30 });
    expect(hoursMinutes(2520)).toEqual({ h: 0, m: 42 });
    expect(hoursMinutes(9660)).toEqual({ h: 2, m: 41 });
    expect(hoursMinutes(20)).toEqual({ h: 0, m: 1 });
    expect(hoursMinutes(3599)).toEqual({ h: 1, m: 0 });
  });
});
