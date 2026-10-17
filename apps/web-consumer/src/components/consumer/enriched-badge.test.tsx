import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceProfile } from "@mesita/place-profile";
import { placeRowToDetail } from "@mesita/place-profile/map";

function profile(over: Record<string, unknown>) {
  const place = placeRowToDetail({
    id: "p-1",
    mesita_name: "Lupita",
    category_label: "Restaurant",
    ...over,
  });
  return renderToStaticMarkup(<PlaceProfile place={place} />);
}

describe("the Enriched mark beside the place name", () => {
  it("shows on an enriched place's profile", () => {
    expect(profile({ enriched_at: "2026-01-01T00:00:00Z" })).toContain(
      'aria-label="Enriched"',
    );
  });

  it("never shows on a Created place's profile", () => {
    expect(profile({ enriched_at: null })).not.toContain(
      'aria-label="Enriched"',
    );
  });
});
