import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "./useHydrated";

function Probe() {
  const hydrated = useHydrated();
  return (
    <button type="button" disabled={!hydrated}>
      {String(hydrated)}
    </button>
  );
}

describe("useHydrated", () => {
  it("is false in the server's HTML, so a button that needs the client starts disabled and a click before hydration can't be lost", () => {
    const html = renderToString(<Probe />);
    expect(html).toContain("disabled");
    expect(html).toContain("false");
  });
});
