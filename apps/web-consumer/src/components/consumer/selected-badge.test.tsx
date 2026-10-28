import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceProfile } from "@mesita/place-profile";
import { placeRowToDetail } from "@mesita/place-profile/map";

function profile(over: Record<string, unknown>) {
  const place = placeRowToDetail({
    id: "p-1",
    name: "Lupita",
    category_label: "Restaurant",
    ...over,
  });
  return renderToStaticMarkup(<PlaceProfile place={place} />);
}

// Three states, never one another (MESITA-2913): the mark is Selected's.
describe("the Selected mark beside the place name", () => {
  it("shows on a Mesita Selected place's profile", () => {
    expect(profile({ selected: true })).toContain('aria-label="Mesita Selected"');
  });

  it("never shows for Enriched alone", () => {
    const html = profile({ selected: false, enriched_at: "2026-01-01T00:00:00Z" });
    expect(html).not.toContain('aria-label="Mesita Selected"');
    expect(html).not.toContain('aria-label="Enriched"');
  });
});
