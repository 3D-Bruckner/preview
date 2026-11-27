import { describe, expect, it } from "vitest";
import { isRecent } from "./format";

describe("isRecent", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  it("is true within 7 days", () => {
    expect(isRecent("2026-11-21T10:00:00Z", now)).toBe(true);
  });
  it("is false just over 7 days", () => {
    expect(isRecent("2026-11-20T09:59:00Z", now)).toBe(false);
  });
});
