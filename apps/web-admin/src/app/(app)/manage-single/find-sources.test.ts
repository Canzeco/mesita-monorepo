import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  autocompleteGooglePlaces: vi.fn(),
  listAllPlaces: vi.fn(),
  searchMesitaNames: vi.fn(),
}));
vi.mock("@/app/(app)/manage-multiple/actions", () => actions);

import {
  loadCatalogSource,
  searchAutocompleteSource,
  searchNameSource,
  searchTextSource,
} from "./find-sources";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Find's sources never throw", () => {
  it("turns an action's failure into that source's error", async () => {
    actions.searchMesitaNames.mockResolvedValue({ ok: false, error: "no embedding key" });
    expect(await searchNameSource("cafe")).toEqual({ status: "error", error: "no embedding key" });
    actions.autocompleteGooglePlaces.mockRejectedValue(new Error("network"));
    expect(await searchAutocompleteSource("cafe")).toEqual({ status: "error", error: "network" });
    actions.listAllPlaces.mockResolvedValue({ ok: true, data: { places: [], total: 0 } });
    expect(await loadCatalogSource()).toEqual({ status: "ok", data: [] });
  });

  it("gives Name Search and Autocomplete a session token each", async () => {
    actions.searchMesitaNames.mockResolvedValue({ ok: true, data: [] });
    actions.autocompleteGooglePlaces.mockResolvedValue({ ok: true, data: [] });
    await searchNameSource("cafe");
    await searchAutocompleteSource("cafe");
    expect(actions.searchMesitaNames.mock.calls[0]?.[1]).toMatch(/[0-9a-f-]{36}/);
    expect(actions.autocompleteGooglePlaces.mock.calls[0]?.[1]).toMatch(/[0-9a-f-]{36}/);
  });

  it("reads Text Search's one query and its floors through /api/bulk-search", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: true,
            queries: [{ query: "cafe", places: [{ id: "g1" }], rawCount: 5, truncated: false, error: null }],
            uniquePlaces: [],
            minRating: 4,
            minUserRatingCount: 50,
            filteredOutCount: 4,
            mesitaLookupError: null,
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await searchTextSource("cafe");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ queries: ["cafe"], placeIds: [] });
    expect(r).toEqual({
      status: "ok",
      data: { places: [{ id: "g1" }], minRating: 4, minUserRatingCount: 50, filteredOutCount: 4, mesitaLookupError: null },
    });
  });

  it("reports a Text Search query error as the source's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, queries: [{ query: "cafe", places: [], error: "quota" }], uniquePlaces: [] })),
      ),
    );
    expect(await searchTextSource("cafe")).toEqual({ status: "error", error: "quota" });
  });
});
