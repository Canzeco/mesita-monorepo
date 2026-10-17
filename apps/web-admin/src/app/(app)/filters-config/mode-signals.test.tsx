import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignalsConfigClient } from "./SignalsConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

describe("signals are raw numbers", () => {
  it("shows the shape knobs and no simulator", () => {
    const html = renderToStaticMarkup(
      <SignalsConfigClient
        initialConfig={DEFAULT_CONFIG}
        initialUpdatedAt={null}
        loadError={null}
      />,
    );
    const labels = ["Name", "Description", "Family", "Proximity", "Timing", "Enriched", "Popularity", "Randomness"];
    let last = -1;
    for (const label of labels) {
      const idx = html.indexOf(label);
      expect(idx, label).toBeGreaterThan(last);
      last = idx;
    }
    expect(html).toContain("Max km");
    expect(html).toContain("Closed floor");
    expect(html).not.toContain("Search query");
    expect(html).not.toContain("Preview");
    expect(html).not.toContain("Effective contribution");
    expect(html).not.toContain("Proximity curve");
  });
});
