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

  it("has a reset button named in the page's language, disabled until the model has loaded", () => {
    const de = renderToString(<ModelViewer src={SRC} label="x" facts={emptyFacts()} />);
    expect(de).toMatch(/<button[^>]*disabled=""[^>]*>.*Ansicht zurücksetzen.*<\/button>/);
    const en = renderToString(
      <CopyProvider lang="en">
        <ModelViewer src={SRC} label="x" facts={emptyFacts()} />
      </CopyProvider>,
    );
    expect(en).toMatch(/<button[^>]*>.*Reset view.*<\/button>/);
    expect(en).toContain("Loading the 3D view");
  });
});
