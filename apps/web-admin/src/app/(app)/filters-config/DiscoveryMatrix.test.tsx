import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryMatrix } from "./DiscoveryMatrix";

describe("Discovery matrix", () => {
  it("marks Name (Deep) × Nearby Search red — Deep does not call that API", () => {
    const html = renderToStaticMarkup(<DiscoveryMatrix />);
    expect(html).toContain(
      "Google Places Nearby Search · Name (Deep) · off",
    );
    expect(html).not.toContain(
      "Google Places Nearby Search · Name (Deep) · on",
    );
    expect(html).toContain("Google Places Nearby Search · Map · on");
    expect(html).toContain(
      "Google Places Autocomplete · Name (Deep) · on",
    );
    expect(html).toContain(
      "Google Places Text Search · Name (Deep) · on",
    );
    expect(html).toContain("Mesita Listed · Favorites · not required");
    expect(html).toContain("Mesita Enriched · Favorites · not required");
    expect(html).toContain("Google Places · Favorites · required");
    expect(html).toContain("border-t-2");
    expect(html).toContain("Places Lineup Randomness · Map · off");
    expect(html).not.toContain(">0</span>");
  });

  it("returns Locations on the two Name modes only — Autocomplete is the one module that answers with a region", () => {
    const html = renderToStaticMarkup(<DiscoveryMatrix />);
    expect(html).toContain("Locations · Name (Fast) · returned");
    expect(html).toContain("Locations · Name (Deep) · returned");
    for (const mode of ["Map", "Swipe", "Catalog", "Chat", "Social", "Favorites"]) {
      expect(html).toContain(`Locations · ${mode} · not returned`);
      expect(html).toContain(`Places · ${mode} · returned`);
    }
    // Places come back everywhere, Fast and Deep included.
    expect(html).toContain("Places · Name (Fast) · returned");
    expect(html).toContain("Places · Name (Deep) · returned");
    expect(html).not.toContain("Places · Name (Fast) · not returned");
  });
});
