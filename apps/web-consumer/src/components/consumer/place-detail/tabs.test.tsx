import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlaceTabBar, placeTabs } from "./tabs";

// The vote panel and its copy are gone (MESITA-2642: visits enrich a place,
// no guest votes); only the section strip's pins remain here.
describe("section strip", () => {
  it("is the four sections for every place, Boost the fourth, Enrich never a tab (MESITA-2332, MESITA-2861)", () => {
    expect(placeTabs().map((t) => t.label)).toEqual([
      "Overview",
      "Reviews",
      "Products",
      "Boost",
    ]);
    expect(placeTabs().filter((t) => t.soon).map((t) => t.label)).toEqual([
      "Products",
    ]);
  });

  it("renders the four sections, no Soon pill in the strip (MESITA-2631)", () => {
    const html = renderToStaticMarkup(
      <PlaceTabBar tab="place" onChange={() => {}} />,
    );
    expect(html).toContain("Overview");
    expect(html).toContain("Reviews");
    expect(html).toContain("Products");
    expect(html).not.toContain(">Menu<");
    expect(html).toContain("Boost");
    expect(html).not.toContain("Soon");
    expect(html).not.toContain("Enrich");
  });
});
