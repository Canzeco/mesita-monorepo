import { describe, expect, it } from "vitest";

import type { CatalogRail, Place } from "@/lib/api/places";
import { sortCatalogRails, summarizeCatalog } from "@/lib/catalog-summary";

const place = (id: string, open: boolean | null) =>
  ({ id, name: id, open_now: open }) as unknown as Place;
const rail = (key: string, places: Place[]): CatalogRail => ({
  key,
  label: key,
  source: "seed",
  places,
});

describe("Catalog's count and sort (MESITA-2135)", () => {
  const rails = [
    rail("tacos", [place("a", false), place("b", true), place("c", null)]),
    // "b" again on a second rail: the header must not count it twice.
    rail("date-night", [place("b", true), place("d", true)]),
  ];

  it("counts each place once, however many rails carry it", () => {
    expect(summarizeCatalog(rails)).toEqual({ total: 4, openNow: 2 });
  });

  it("an unknown open state is not counted as open", () => {
    expect(summarizeCatalog([rail("x", [place("c", null)])]).openNow).toBe(0);
  });

  it("Suggested keeps the server's order exactly", () => {
    const out = sortCatalogRails(rails, "suggested");
    expect(out[0].places.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("Open first lifts open places inside each rail, stably", () => {
    const out = sortCatalogRails(rails, "open");
    expect(out[0].places.map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(out[1].places.map((p) => p.id)).toEqual(["b", "d"]);
    // The input is never mutated: Suggested must still read server order.
    expect(rails[0].places.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});
