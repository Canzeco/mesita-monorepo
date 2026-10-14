import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryMatrix } from "./DiscoveryMatrix";

describe("Discovery matrix", () => {
  it("marks Word × Nearby Search hollow — the guest pin is a bias, not a call", () => {
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
    // Browse and Flexible are gone (MESITA-2195). Catalog is the one door.
    expect(html).toContain("Mesita Places Catalog Search · Catalog · on");
    expect(html).toContain("Mesita Places Catalog Search · Scroll · on");
    expect(html).toContain("Mesita Places Catalog Search · Chat · on");
    expect(html).not.toContain("Browse Search");
    expect(html).not.toContain("Flexible Search");
    expect(html).not.toContain("· Feed ·");
    // Social lost its mode, not its retrieval: Catalog rails the events and
    // Chat is asked about them.
    expect(html).toContain("Mesita Social Catalog Search · Catalog · on");
    expect(html).toContain("Mesita Social Catalog Search · Chat · on");
    // THE THREE NESTED PLACE TYPES (MESITA-2158). Mesita Listed stays
    // retired: Mesita Places is a ready profile, not a row existing.
    expect(html).not.toContain("Mesita Listed");
    expect(html).toContain("Google Places · Favorites · required");
    expect(html).toContain("Mesita Places · Map · required");
    expect(html).toContain("Mesita Places · Favorites · not required");
    expect(html).toContain("Mesita Enriched Places · Favorites · not required");
    expect(html).not.toContain("Mesita Partnered Places");
    expect(html).toContain("Mesita Enriched Places · Map · required");
    expect(html).toContain("Mesita Enriched Places · Catalog · required");
    expect(html).toContain("Mesita Enriched Places · Scroll · required");
    // ONE GRAMMAR, IN INK. Fill says on, a hollow outline says off, on every
    // band — no hue encodes a boolean anywhere in this table.
    expect(html).not.toContain("emerald");
    expect(html).not.toContain("rose");
    expect(html).toContain("bg-foreground");
    // Every mark carries its name in text; `title` alone is not one.
    expect(html).toContain("sr-only");
    expect(html).toContain("border-t-2");
    // Band title carries the class noun; the row is the bare signal name.
    expect(html).toContain("Randomness · Map · off");
    expect(html).not.toContain("Places Lineup Randomness");
    expect(html).not.toContain(">0</span>");
  });

  it("returns Locations on Word alone — Autocomplete is the one source that answers with a region", () => {
    const html = renderToStaticMarkup(<DiscoveryMatrix />);
    expect(html).toContain("Locations · Word · returned");
    for (const mode of ["Map", "Catalog", "Scroll", "Chat", "Favorites"]) {
      expect(html).toContain(`Locations · ${mode} · not returned`);
      expect(html).toContain(`Places · ${mode} · returned`);
    }
    expect(html).toContain("Places · Word · returned");
    expect(html).not.toContain("Places · Word · not returned");
    // Socials is the third Result Entity, and it rides the two modes that
    // call Mesita Social Catalog Search. Spec-only: that source is Soon.
    expect(html).toContain("Socials · Catalog · returned");
    expect(html).toContain("Socials · Chat · returned");
    for (const mode of ["Word", "Map", "Scroll", "Favorites"]) {
      expect(html).toContain(`Socials · ${mode} · not returned`);
    }
    // Social is not a mode any more; it has no column.
    expect(html).not.toContain("· Social ·");
  });
});
