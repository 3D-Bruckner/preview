import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CopyProvider } from "./CopyProvider";
import { emptyFacts } from "@/backend/client";
import { ModelViewer } from "./ModelViewer";

const SRC = "/k/token/files/version/model.3mf";

describe("ModelViewer", () => {
  it("is a loading state in the server's HTML, with the view named by the model's title and the 3MF it will load", () => {
    const html = renderToString(<ModelViewer src={SRC} label="3D-Ansicht von Rampe" facts={emptyFacts()} />);
    expect(html).toMatch(/role="img"[^>]*aria-label="3D-Ansicht von Rampe"|aria-label="3D-Ansicht von Rampe"[^>]*role="img"/);
    expect(html).toContain(`data-threemf="${SRC}"`);
    expect(html).toContain('data-state="loading"');
    expect(html).toMatch(/role="status"[^>]*>.*3D-Ansicht wird geladen/);
  });

  it("has the view's tools named in the page's language, the camera ones disabled until the model has loaded", () => {
    const de = renderToString(<ModelViewer src={SRC} label="x" facts={emptyFacts()} />);
    expect(de).toMatch(/<button[^>]*aria-label="Einpassen"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Einpassen"/);
    expect(de).toMatch(/role="group" aria-label="Ansicht"/);
    expect(de).toMatch(/<button[^>]*disabled=""[^>]*>Oben<\/button>/);
    expect(de).toMatch(/aria-label="Raster"/);
    // Full screen is offered only once the page runs and knows the browser allows it.
    expect(de).not.toContain("Vollbild");
    const en = renderToString(
      <CopyProvider lang="en">
        <ModelViewer src={SRC} label="x" facts={emptyFacts()} />
      </CopyProvider>,
    );
    expect(en).toMatch(/aria-label="Fit"/);
    expect(en).toContain("Loading the 3D view");
  });
});
