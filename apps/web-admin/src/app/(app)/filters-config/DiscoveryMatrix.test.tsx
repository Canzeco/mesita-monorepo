import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryMatrix } from "./DiscoveryMatrix";

describe("Discovery matrix", () => {
  it("marks Word × Nearby Search red — the guest pin is a bias, not a call", () => {
    const html = renderToStaticMarkup(<DiscoveryMatrix />);
    expect(html).toContain("Google Places Nearby Search · Word · off");
    expect(html).not.toContain("Google Places Nearby Search · Word · on");
    expect(html).toContain("Google Places Nearby Search · Map · on");
    expect(html).toContain(
      "Google Places Autocomplete Search · Word · on",
    );
    expect(html).toContain("Google Places Text Search · Word · on");
    expect(html).toContain("Mesita Places Name Search · Word · on");
    expect(html).toContain("Mesita Places Nearby Search · Map · on");
    expect(html).toContain("Mesita Places Browse Search · Catalog · on");
    expect(html).toContain("Mesita Places Flexible Search · Swipe · on");
    expect(html).toContain("Mesita Places Flexible Search · Chat · on");
    // Social lost its mode, not its retrieval: Catalog rails the events and
    // Chat is asked about them.
    expect(html).toContain("Mesita Social Browse Search · Catalog · on");
    expect(html).toContain("Mesita Social Flexible Search · Chat · on");
    expect(html).toContain("Mesita Listed · Favorites · not required");
    expect(html).toContain("Mesita Enriched · Favorites · not required");
    expect(html).toContain("Google Places · Favorites · required");
    expect(html).toContain("border-t-2");
    // Band title carries the class noun; the row is the bare signal name.
    expect(html).toContain("Randomness · Map · off");
    expect(html).not.toContain("Places Lineup Randomness");
    expect(html).not.toContain(">0</span>");
  });

  it("returns Locations on Word alone — Autocomplete is the one source that answers with a region", () => {
    const html = renderToStaticMarkup(<DiscoveryMatrix />);
    expect(html).toContain("Locations · Word · returned");
    for (const mode of ["Map", "Catalog", "Swipe", "Chat", "Favorites"]) {
      expect(html).toContain(`Locations · ${mode} · not returned`);
      expect(html).toContain(`Places · ${mode} · returned`);
    }
    expect(html).toContain("Places · Word · returned");
    expect(html).not.toContain("Places · Word · not returned");
    // Social is not a mode any more; it has no column.
    expect(html).not.toContain("· Social ·");
  });
});
