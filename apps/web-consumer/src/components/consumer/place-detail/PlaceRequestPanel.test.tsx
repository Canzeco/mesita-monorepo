import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PlaceRequestPanelView,
  requestProgressLabel,
  requestProgressMeta,
} from "./PlaceRequestPanel";
import { PlaceTabBar, placeTabs } from "./tabs";

describe("vote progress copy", () => {
  it("labels zero, below-threshold and threshold-crossing votes", () => {
    expect(requestProgressLabel(0, 5)).toBe("0 of 5 votes");
    expect(requestProgressLabel(2, 5)).toBe("2 of 5 votes");
    expect(requestProgressLabel(5, 5)).toBe("5 of 5 votes");
  });

  it("progress meta caps filled segments", () => {
    expect(requestProgressMeta(7, 5)).toEqual({
      count: 7,
      threshold: 5,
      filled: 5,
      remaining: 0,
      complete: true,
    });
  });
});

describe("section strip", () => {
  it("is the four sections for every place, Enrich never a tab (MESITA-2332)", () => {
    expect(placeTabs().map((t) => t.label)).toEqual([
      "Overview",
      "Reviews",
      "Products",
      "Rewards",
    ]);
    expect(placeTabs().filter((t) => t.soon).map((t) => t.label)).toEqual([
      "Products",
      "Rewards",
    ]);
  });

  it("renders the four sections with Soon on Products and Rewards", () => {
    const html = renderToStaticMarkup(
      <PlaceTabBar tab="place" onChange={() => {}} />,
    );
    expect(html).toContain("Overview");
    expect(html).toContain("Reviews");
    expect(html).toContain("Products");
    expect(html).not.toContain(">Menu<");
    expect(html).toContain("Rewards");
    expect(html).toContain("Soon");
    expect(html).toContain("grid-cols-4");
    expect(html).not.toContain("Enrich");
  });
});

describe("PlaceRequestPanel", () => {
  it("is the Enrich vote page on the ugly profile", () => {
    const html = renderToStaticMarkup(
      <PlaceRequestPanelView
        count={2}
        threshold={5}
        requested={false}
        enriching={false}
        pending={false}
        error={null}
      />,
    );
    expect(html).toContain("Vote to enrich this place");
    expect(html).toContain("Vote to enrich");
    expect(html).toContain("2 of 5 votes");
    expect(html).toContain("3 more votes start Enrich");
    expect(html).toContain('role="progressbar"');
  });

  it("shows You voted after this consumer already voted", () => {
    const html = renderToStaticMarkup(
      <PlaceRequestPanelView
        count={1}
        threshold={5}
        requested={true}
        enriching={false}
        pending={false}
        error={null}
      />,
    );
    expect(html).toContain("You voted");
  });
});
