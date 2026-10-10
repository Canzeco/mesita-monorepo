import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlaceLite } from "@/lib/places-types";
import { GoogleMatchList, type GoogleState } from "./GoogleMatches";

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

function render(google: GoogleState, notes = {}) {
  return renderToStaticMarkup(
    <GoogleMatchList
      query="cafe"
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
});
