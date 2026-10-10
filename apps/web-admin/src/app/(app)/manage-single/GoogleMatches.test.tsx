import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaceLite } from "@/lib/places-types";
import {
  GoogleMatchList,
  searchGoogleNearby,
  type GoogleSource,
  type GoogleState,
} from "./GoogleMatches";

function lite(over: Partial<PlaceLite>): PlaceLite {
  return {
    id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    displayName: "Cafe Nin",
    formattedAddress: "Calle Havre 73, Juárez",
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

const HELD = lite({ existsInMesita: true });
const NEW = lite({ id: "ChIJ0000000000000000000000", displayName: "Taquería Orinoco", rating: null });

function render(google: GoogleState, notes = {}, source: GoogleSource = "text") {
  return renderToStaticMarkup(
    <GoogleMatchList
      query="cafe"
      source={source}
      google={google}
      onMesita={(p) => p.existsInMesita}
      notes={notes}
      disabled={false}
      onOpen={() => {}}
      onAdd={() => {}}
    />,
  );
}

const OK: Extract<GoogleState, { status: "ok" }> = {
  status: "ok",
  result: {
    places: [HELD, NEW],
    minRating: 4,
    minUserRatingCount: 50,
    filteredOutCount: 3,
    mesitaLookupError: null,
  },
};

describe("Single Place › From Google", () => {
  it("marks a place Mesita holds On Mesita and gives the other Add", () => {
    const html = render(OK);
    expect(html).toContain("2 results · 1 on Mesita");
    expect(html).toContain("Cafe Nin");
    expect(html).toContain("4.6 · 2,431 reviews");
    expect(html).toContain("On Mesita");
    expect(html).toContain("Taquería Orinoco");
    expect(html.match(/>Add</g)).toHaveLength(1);
  });

  it("says what Discovery › Map hid, with the floors", () => {
    expect(render(OK)).toContain("3 more hidden by Discovery › Map (rating ≥ 4, reviews ≥ 50).");
  });

  it("shows an Add in flight and an Add's outcome on its row", () => {
    expect(render(OK, { [NEW.id]: { state: "running", text: "Adding…" } })).toContain("Adding…");
    const done = render(OK, { [NEW.id]: { state: "ok", text: "Created · enrich queued" } });
    expect(done).toContain("Created · enrich queued");
  });

  it("reads loading, failure and an empty page as themselves", () => {
    expect(render({ status: "loading" })).toContain("Searching Google for “cafe”");
    expect(render({ status: "error", error: "quota" })).toContain("Google search failed: quota");
    expect(
      render({ status: "ok", result: { ...OK.result, places: [], filteredOutCount: 0 } }),
    ).toContain("Google found nothing for “cafe”.");
  });

  it("names Autocomplete in its own sentences, rows unchanged", () => {
    expect(render({ status: "loading" }, {}, "autocomplete")).toContain(
      "Asking Google Autocomplete for “cafe”",
    );
    expect(render({ status: "error", error: "quota" }, {}, "autocomplete")).toContain(
      "Google Autocomplete failed: quota",
    );
    const empty = { ...OK.result, places: [], filteredOutCount: 0 };
    expect(render({ status: "ok", result: empty }, {}, "autocomplete")).toContain(
      "Google Autocomplete suggests nothing for “cafe”.",
    );
    expect(render(OK, {}, "autocomplete")).toContain("2 results · 1 on Mesita");
  });

  it("names Nearby by the place it searches around", () => {
    expect(render({ status: "loading" }, {}, "nearby")).toContain(
      "Searching Google for places near “cafe”",
    );
    expect(render({ status: "error", error: "quota" }, {}, "nearby")).toContain(
      "Google Nearby failed: quota",
    );
  });
});

describe("searchGoogleNearby", () => {
  afterEach(() => vi.unstubAllGlobals());

  function reply(body: unknown) {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body)),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("sends the point alone and reads the nearby list, counting what the floors hid", async () => {
    const fetchMock = reply({
      ok: true,
      queries: [],
      nearby: { query: "nearby:1,2", places: [HELD], rawCount: 5, truncated: false, error: null },
      uniquePlaces: [],
      minRating: 4,
      minUserRatingCount: 50,
      filteredOutCount: 0,
      mesitaLookupError: null,
    });
    const g = await searchGoogleNearby({ lat: 1, lng: 2 });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      queries: [],
      placeIds: [],
      nearby: { lat: 1, lng: 2 },
    });
    expect(g).toEqual({
      status: "ok",
      result: {
        places: [HELD],
        minRating: 4,
        minUserRatingCount: 50,
        filteredOutCount: 4,
        mesitaLookupError: null,
      },
    });
  });

  it("surfaces the Nearby slot's own error", async () => {
    reply({
      ok: true,
      queries: [],
      nearby: { query: "nearby:1,2", places: [], rawCount: 0, truncated: false, error: "no type on" },
      uniquePlaces: [],
      minRating: 0,
      minUserRatingCount: 0,
      filteredOutCount: 0,
      mesitaLookupError: null,
    });
    expect(await searchGoogleNearby({ lat: 1, lng: 2 })).toEqual({
      status: "error",
      error: "no type on",
    });
  });
});
