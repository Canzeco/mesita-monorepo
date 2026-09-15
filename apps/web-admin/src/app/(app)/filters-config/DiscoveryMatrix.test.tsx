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
    // Catalog became FLEXIBLE at MESITA-1697 — its surface (Home's Feed)
    // gained a filter control, so consumer-web-list-catalog now cuts its pool
    // with the guest's predicates instead of admitting on nothing. The mode
    // KEY is still `catalog`; only the displayed label moved to Feed.
    expect(html).toContain("Mesita Places Flexible Search · Feed · on");
    expect(html).toContain("Mesita Places Flexible Search · Scroll · on");
    expect(html).toContain("Mesita Places Flexible Search · Chat · on");
    // Social lost its mode, not its retrieval: Catalog rails the events and
    // Chat is asked about them.
    // The Socials rails are still Browse — no guest predicate reaches them.
    expect(html).toContain("Mesita Socials Browse Search · Feed · on");
    expect(html).toContain("Mesita Socials Flexible Search · Chat · on");
    // Places Browse kept its row when it lost its caller (MESITA-1856): the
    // Sources page still renders its box, so the row is off for every mode
    // rather than absent.
    for (const mode of ["Word", "Map", "Feed", "Scroll", "Chat", "Favorites"]) {
      expect(html).toContain(`Mesita Places Browse Search · ${mode} · off`);
      expect(html).not.toContain(`Mesita Places Browse Search · ${mode} · on`);
    }
    // THE THREE NESTED PLACE TYPES. Mesita Listed retired: listing is a row
    // existing, which no mode gates on — enrichment is the gate that runs.
    expect(html).not.toContain("Mesita Listed");
    expect(html).toContain("Google Places · Favorites · required");
    expect(html).toContain("Mesita Enriched Places · Favorites · not required");
    expect(html).toContain("Mesita Partnered Places · Favorites · not required");
    expect(html).toContain("Mesita Enriched Places · Map · required");
    expect(html).toContain("Mesita Partnered Places · Map · required");
    expect(html).toContain("Mesita Enriched Places · Feed · required");
    expect(html).toContain("Mesita Partnered Places · Feed · not required");
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
    for (const mode of ["Map", "Feed", "Scroll", "Chat", "Favorites"]) {
      expect(html).toContain(`Locations · ${mode} · not returned`);
      expect(html).toContain(`Places · ${mode} · returned`);
    }
    expect(html).toContain("Places · Word · returned");
    expect(html).not.toContain("Places · Word · not returned");
    // Socials is the third Result Entity, and it rides the two modes that
    // carry an event source. Spec-only: both Socials sources are Soon.
    expect(html).toContain("Socials · Feed · returned");
    expect(html).toContain("Socials · Chat · returned");
    for (const mode of ["Word", "Map", "Scroll", "Favorites"]) {
      expect(html).toContain(`Socials · ${mode} · not returned`);
    }
    // Social is not a mode any more; it has no column.
    expect(html).not.toContain("· Social ·");
  });
});
