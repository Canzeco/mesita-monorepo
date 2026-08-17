import { describe, expect, it } from "vitest";

import {
  filterPlacesByQuery,
  foldForSearch,
  type SearchablePlace,
} from "@/lib/place-search";

// The Visit wallet's searchbar (MESITA-1071). The component only renders what
// this returns, so the matching rules are pinned here rather than trusted to a
// screenshot.

const STRANA: SearchablePlace = {
  name: "Strana",
  zone: "Zona Hotelera",
  category_label: "Nightclub",
  category: "nightclub",
};
const CANCUN_SUSHI: SearchablePlace = {
  name: "Sushi Cancún",
  zone: "Centro",
  category_label: "Sushi",
  category: "sushi",
};
const ZONA_TACOS: SearchablePlace = {
  name: "Tacos El Jefe",
  zone: "Zona Hotelera",
  category_label: "Taquería",
  category: "taqueria",
};
const ALL = [STRANA, CANCUN_SUSHI, ZONA_TACOS];

describe("foldForSearch", () => {
  it("strips diacritics and lowercases", () => {
    expect(foldForSearch("Cancún")).toBe("cancun");
    expect(foldForSearch("TAQUERÍA")).toBe("taqueria");
  });
});

describe("filterPlacesByQuery", () => {
  it("returns everything for an empty or whitespace-only query", () => {
    // An empty field is not a filter — this is what keeps the resting wallet
    // a full place list.
    expect(filterPlacesByQuery(ALL, "")).toEqual(ALL);
    expect(filterPlacesByQuery(ALL, "   ")).toEqual(ALL);
  });

  it("matches on name, case-insensitively", () => {
    expect(filterPlacesByQuery(ALL, "strana")).toEqual([STRANA]);
    expect(filterPlacesByQuery(ALL, "STRANA")).toEqual([STRANA]);
  });

  it("matches on zone and on category", () => {
    expect(filterPlacesByQuery(ALL, "zona")).toEqual([STRANA, ZONA_TACOS]);
    expect(filterPlacesByQuery(ALL, "nightclub")).toEqual([STRANA]);
  });

  it("matches accent-blind in both directions", () => {
    // The guest's keyboard is the reason this exists: "cancun" must find
    // "Cancún", and someone who does type the accent must still get the hit.
    expect(filterPlacesByQuery(ALL, "cancun")).toEqual([CANCUN_SUSHI]);
    expect(filterPlacesByQuery(ALL, "Cancún")).toEqual([CANCUN_SUSHI]);
    expect(filterPlacesByQuery(ALL, "taqueria")).toEqual([ZONA_TACOS]);
  });

  it("AND-s tokens, so more words narrow the result", () => {
    expect(filterPlacesByQuery(ALL, "zona tacos")).toEqual([ZONA_TACOS]);
    // "zona" alone matches two; adding a word that only one carries cuts it
    // to one. If tokens were OR-ed this would widen instead.
    expect(filterPlacesByQuery(ALL, "zona").length).toBe(2);
  });

  it("ignores token order and extra whitespace", () => {
    expect(filterPlacesByQuery(ALL, "tacos zona")).toEqual([ZONA_TACOS]);
    expect(filterPlacesByQuery(ALL, "  zona   tacos  ")).toEqual([ZONA_TACOS]);
  });

  it("returns empty when nothing matches", () => {
    // Drives the no-match state, which must stay distinct from the
    // empty-catalog state.
    expect(filterPlacesByQuery(ALL, "sdfghjk")).toEqual([]);
  });

  it("preserves input order, leaving the partners-first sort intact", () => {
    expect(filterPlacesByQuery([ZONA_TACOS, STRANA], "zona")).toEqual([
      ZONA_TACOS,
      STRANA,
    ]);
  });

  it("does not match on fields the row never renders", () => {
    // A hit the guest cannot see reads as a bug.
    const withHiddenField = [
      { ...STRANA, name: "Strana", slug: "strana-cancun-vip" },
    ];
    expect(filterPlacesByQuery(withHiddenField, "vip")).toEqual([]);
  });

  it("tolerates missing zone and category", () => {
    const bare: SearchablePlace = { name: "Bare" };
    expect(filterPlacesByQuery([bare], "bare")).toEqual([bare]);
    expect(filterPlacesByQuery([bare], "zona")).toEqual([]);
  });
});
