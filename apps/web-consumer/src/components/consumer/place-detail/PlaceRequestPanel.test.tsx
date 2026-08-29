import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PlaceRequestPanelView,
  requestProgressLabel,
  requestProgressMeta,
  requestVotesRemaining,
  showEnrichTab,
} from "./PlaceRequestPanel";
import { PlaceTabBar, placeTabs } from "./tabs";

describe("vote progress copy", () => {
  it("zero votes", () => {
    expect(requestProgressLabel(0, 5)).toBe("0 of 5 votes");
  });

  it("below-threshold votes", () => {
    expect(requestProgressLabel(2, 5)).toBe("2 of 5 votes");
  });

  it("threshold crossing", () => {
    expect(requestProgressLabel(5, 5)).toBe("5 of 5 votes");
  });

  it("remaining helper", () => {
    expect(requestVotesRemaining(2, 5)).toBe(3);
    expect(requestVotesRemaining(5, 5)).toBe(0);
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

describe("Enrich tab gate", () => {
  it("shows only while not Enriched", () => {
    expect(showEnrichTab({ is_enriched: false })).toBe(true);
    expect(showEnrichTab({ is_enriched: true })).toBe(false);
  });

  it("is Enrich-only until Enriched, then the four core tabs", () => {
    expect(placeTabs(false).map((t) => t.label)).toEqual(["Enrich"]);
    expect(placeTabs(true).map((t) => t.label)).toEqual([
      "Overview",
      "Reviews",
      "Menus",
      "Rewards",
    ]);
  });

  it("renders Enrich and not the core tabs on the unenriched strip", () => {
    const html = renderToStaticMarkup(
      <PlaceTabBar tab="enrich" onChange={() => {}} enriched={false} />,
    );
    expect(html).toContain("Enrich");
    expect(html).toContain("grid-cols-1");
    expect(html).not.toContain("Overview");
    expect(html).not.toContain("Reviews");
    expect(html).not.toContain("Menus");
    expect(html).not.toContain("Rewards");
  });

  it("renders the four core tabs and not Enrich once Enriched", () => {
    const html = renderToStaticMarkup(
      <PlaceTabBar tab="place" onChange={() => {}} enriched={true} />,
    );
    expect(html).toContain("Overview");
    expect(html).toContain("Reviews");
    expect(html).toContain("Menus");
    expect(html).toContain("Rewards");
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
    expect(html).not.toContain("Profile not created yet");
    expect(html).not.toContain("Request the profile");
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
