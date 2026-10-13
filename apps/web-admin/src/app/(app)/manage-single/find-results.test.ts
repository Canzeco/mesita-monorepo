import { describe, expect, it } from "vitest";
import type { PlaceHit, SuggestHit } from "@/app/(app)/manage-multiple/actions";
import type { PlaceLite } from "@/lib/places-types";
import { catalogueList, mergeFindResults, type FindInputs, type TextSearchResult } from "./find-results";

const A = "ChIJAAAAAAAAAAAAAAAAAAAAAA"; // held, every source
const B = "ChIJBBBBBBBBBBBBBBBBBBBBBB"; // Google only
const C = "ChIJCCCCCCCCCCCCCCCCCCCCCC"; // Text Search only, held per its join

function hit(over: Partial<PlaceHit>): PlaceHit {
  return {
    id: "mesita-a",
    name: "Café Nin",
    google_name: "Cafe Nin",
    address: "Calle Havre 73, Juárez",
    slug: "cafe-nin",
    google_place_id: A,
    ...over,
  } as PlaceHit;
}

function suggest(over: Partial<SuggestHit>): SuggestHit {
  return { placeId: A, mainText: "Cafe Nin", secondaryText: "CDMX", state: "not_in_mesita", ...over };
}

function lite(over: Partial<PlaceLite>): PlaceLite {
  return {
    id: A,
    displayName: "Cafe Nin",
    formattedAddress: "C. Havre 73, Juárez, 06600 Ciudad de México",
    lat: null,
    lng: null,
    rating: 4.6,
    userRatingCount: 2431,
    existsInMesita: false,
    createdAt: null,
    updatedAt: null,
    ...over,
  };
}

function text(places: PlaceLite[], over: Partial<TextSearchResult> = {}) {
  return {
    status: "ok" as const,
    data: { places, minRating: 0, minUserRatingCount: 0, filteredOutCount: 0, mesitaLookupError: null, ...over },
  };
}

function inputs(over: Partial<FindInputs> = {}): FindInputs {
  const catalogue = [hit({})];
  return {
    catalogue: { status: "ok", data: catalogue },
    catalog: catalogue,
    name: { status: "ok", data: [suggest({ mainText: "Café Nin", mesitaId: "mesita-a", state: "web_listed" })] },
    autocomplete: { status: "ok", data: [suggest({ placeId: B, mainText: "Brunch Dos" }), suggest({ mesitaId: "mesita-a" })] },
    text: text([lite({}), lite({ id: B, displayName: "Brunch Dos", formattedAddress: "Parque 455", rating: 4.7, userRatingCount: 266 }), lite({ id: C, displayName: "Casa C", existsInMesita: true })]),
    ...over,
  };
}

describe("mergeFindResults", () => {
  it("draws one row per place across all four sources, ranked per source", () => {
    const { rows } = mergeFindResults(inputs());
    expect(rows.map((r) => r.key)).toEqual([A, B, C]);
    expect(rows[0].ranks).toEqual({ catalogue: 1, name: 1, autocomplete: 2, text: 1 });
    expect(rows[1].ranks).toEqual({ catalogue: null, name: null, autocomplete: 1, text: 2 });
    expect(rows[2].ranks).toEqual({ catalogue: null, name: null, autocomplete: null, text: 3 });
  });

  it("orders by agreement, then Text Search rank, Autocomplete, Name Search, Catalogue", () => {
    // Two one-source rows: Text Search #3 beats Autocomplete #1, which beats
    // Name Search #1, which beats Catalogue #1.
    const r = mergeFindResults({
      catalogue: { status: "ok", data: [hit({ id: "m-cat", google_place_id: "ChIJcat000000000000000000" })] },
      catalog: [],
      name: { status: "ok", data: [suggest({ placeId: "ChIJname00000000000000000", mesitaId: "m-name" })] },
      autocomplete: { status: "ok", data: [suggest({ placeId: "ChIJauto00000000000000000" })] },
      text: text([lite({ id: "ChIJt1" }), lite({ id: "ChIJt2" }), lite({ id: "ChIJtext00000000000000000" })]),
    });
    expect(r.rows.map((x) => x.key)).toEqual([
      "ChIJt1",
      "ChIJt2",
      "ChIJtext00000000000000000",
      "ChIJauto00000000000000000",
      "ChIJname00000000000000000",
      "ChIJcat000000000000000000",
    ]);
  });

  it("names a held place by its Mesita name and anything else by Google's (D16)", () => {
    const { rows } = mergeFindResults(inputs());
    expect(rows[0]).toMatchObject({ held: true, mesitaId: "mesita-a", name: "Café Nin" });
    expect(rows[1]).toMatchObject({ held: false, mesitaId: null, name: "Brunch Dos" });
  });

  it("attaches the catalogue hit for place states when Mesita knows the row", () => {
    const { rows } = mergeFindResults(inputs());
    expect(rows[0].placeHit).toMatchObject({ id: "mesita-a", google_place_id: A });
    expect(rows[1].placeHit).toBeNull();
    expect(rows[2].placeHit).toBeNull();
  });

  it("takes the address and rating from Text Search when it has them", () => {
    const { rows } = mergeFindResults(inputs());
    expect(rows[1]).toMatchObject({ address: "Parque 455", rating: 4.7, reviews: 266 });
  });

  it("finds a held place's id in the whole catalogue when no Mesita source named it", () => {
    const catalog = [hit({ id: "mesita-b", name: "Dos Amores", google_place_id: B })];
    const { rows } = mergeFindResults(inputs({ catalogue: { status: "ok", data: [] }, catalog }));
    const b = rows.find((r) => r.key === B);
    expect(b).toMatchObject({ held: true, mesitaId: "mesita-b", name: "Dos Amores" });
    expect(b?.placeHit).toMatchObject({ id: "mesita-b" });
  });

  it("keeps Text Search's held-without-id join: held, no id", () => {
    const { rows } = mergeFindResults(inputs());
    expect(rows[2]).toMatchObject({ key: C, held: true, mesitaId: null });
  });

  it("keys a Mesita place with no Google Place ID by its Mesita id and merges both Mesita sources", () => {
    const r = mergeFindResults({
      catalogue: { status: "ok", data: [hit({ id: "m-x", google_place_id: null })] },
      catalog: [],
      name: { status: "ok", data: [suggest({ placeId: "", mesitaId: "m-x", mainText: "X" })] },
      autocomplete: { status: "ok", data: [] },
      text: text([]),
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ key: "mesita:m-x", googleId: null, held: true });
    expect(r.rows[0].ranks).toMatchObject({ catalogue: 1, name: 1 });
  });

  it("marks a failed source and says why; the others still draw", () => {
    const r = mergeFindResults(inputs({ autocomplete: { status: "error", error: "quota" } }));
    expect(r.failed).toEqual(["autocomplete"]);
    expect(r.notes).toContainEqual({ tone: "error", text: "Google Autocomplete failed: quota" });
    expect(r.rows.every((x) => x.ranks.autocomplete === null)).toBe(true);
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it("carries Discovery › Map's hidden count and the Mesita-lookup error in the notes", () => {
    const r = mergeFindResults(
      inputs({ text: text([lite({})], { filteredOutCount: 4, minRating: 4, minUserRatingCount: 50, mesitaLookupError: "timeout" }) }),
    );
    expect(r.notes.map((n) => n.text)).toEqual([
      "Discovery › Map hid 4 Text Search results (rating ≥ 4, reviews ≥ 50).",
      "Text Search's Mesita lookup failed (timeout); On Mesita reads the catalogue and the Mesita searches only.",
    ]);
  });

  it("lists every catalogue place for the empty search, with no ranks", () => {
    const places = [
      hit({ id: "m-b", name: "Bravo", google_place_id: B }),
      hit({ id: "m-a", name: "Alpha", google_place_id: A }),
    ];
    const r = catalogueList(places, 2);
    expect(r.rows.map((x) => x.name)).toEqual(["Bravo", "Alpha"]);
    expect(r.rows[0]).toMatchObject({
      key: `mesita:m-b`,
      held: true,
      mesitaId: "m-b",
      ranks: { catalogue: null, name: null, autocomplete: null, text: null },
    });
    expect(r.notes.map((n) => n.text)).toContain("Mesita only. Google was not asked.");
  });

  it("notes when the catalogue total exceeds the returned page", () => {
    const r = catalogueList([hit({})], 500);
    expect(r.notes.map((n) => n.text)).toContainEqual(
      "Showing 1 of 500. The rest are past the catalogue ceiling.",
    );
  });

  it("is empty when every source is empty", () => {
    const r = mergeFindResults({
      catalogue: { status: "ok", data: [] },
      catalog: [],
      name: { status: "ok", data: [] },
      autocomplete: { status: "ok", data: [] },
      text: text([]),
    });
    expect(r).toEqual({ rows: [], failed: [], notes: [] });
  });
});
