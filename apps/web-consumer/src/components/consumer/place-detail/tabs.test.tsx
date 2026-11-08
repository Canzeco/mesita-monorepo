import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlaceTabBar, placeTabs } from "@mesita/place-profile";

// The vote panel and its copy are gone (MESITA-2642: views enrich a place,
// no guest votes); only the section strip's pins remain here.
describe("section strip", () => {
  it("is the four sections for every place, Social the fourth, Rewards a sheet and Enrich never a tab (MESITA-2332, MESITA-3412, MESITA-3417)", () => {
    expect(placeTabs().map((t) => t.label)).toEqual([
      "Overview",
      "Menu",
      "Reviews",
      "Social",
    ]);
    expect(placeTabs().filter((t) => t.soon).map((t) => t.label)).toEqual([
      "Menu",
    ]);
  });

  it("renders the four sections, no Soon pill in the strip (MESITA-2631)", () => {
    const html = renderToStaticMarkup(
      <PlaceTabBar tab="place" onChange={() => {}} />,
    );
    expect(html).toContain("Overview");
    expect(html).toContain("Reviews");
    expect(html).toContain("Menu");
    expect(html).not.toContain(">Products<");
    expect(html).not.toContain("Rewards");
    expect(html).not.toContain("Soon");
    expect(html).not.toContain("Enrich");
  });
});
