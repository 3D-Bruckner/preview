import { describe, expect, it } from "vitest";
import { healthResponse } from "./health";
import { testRuntime } from "./testing/runtime";

describe("healthResponse", () => {
  it("answers 200 {status: ok} with an open database", () => {
    const rt = testRuntime();
    try {
      expect(healthResponse(rt)).toEqual({ status: 200, body: { status: "ok" } });
    } finally {
      rt.store.close();
    }
  });

  it("answers 503 once the database is closed", () => {
    const rt = testRuntime();
    rt.store.close();
    expect(healthResponse(rt)).toEqual({ status: 503, body: { status: "unavailable" } });
  });
});
