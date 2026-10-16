import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceProfile } from "./components/PlaceProfile";
import { SoonScreen } from "./components/place-detail/soon-screen";
import { placeRowToDetail } from "./place-to-detail";
import type { PlaceDetail } from "./place-detail";

function detail(over: Record<string, unknown> = {}): PlaceDetail {
  return placeRowToDetail({
    id: "p-1",
    mesita_name: "Lupita",
    enriched_at: "2026-01-01T00:00:00Z",
    category_label: "Restaurant",
    reservations_enabled: true,
    ...over,
  });
}

describe("member preview edges", () => {
  it("keeps a long name and the distance chip", () => {
    const name = "Casa de la Abuela Lupita y los Compadres del Centro Histórico";
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ mesita_name: name })} scrollLabel="Member profile preview" />,
    );
    expect(html).toContain(name);
    expect(html).toContain("- km");
    expect(html).toContain('aria-label="Member profile preview"');
    expect(html).not.toContain("Phone emulator");
  });

  it("shows only Enrich when the place is not enriched", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ enriched_at: null, is_enriched: false })} />,
    );
    expect(html).toContain("Enrich");
    expect(html).not.toContain("Overview");
    expect(html).not.toContain("Rewards");
    expect(html).toContain("Vote to enrich");
  });

  it("keeps Google, Instagram, and Facebook when the socials are empty", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile
        place={detail({
          google_stars_overall: 3.8,
          google_review_count: 484,
        })}
      />,
    );
    expect(html).toContain("3.8");
    expect(html).toContain("484 Google");
    expect(html).toContain("Instagram, Not connected");
    expect(html).toContain("Facebook, Not connected");
    const googleAt = html.indexOf("484 Google");
    const instagramAt = html.indexOf(">Instagram<");
    const facebookAt = html.indexOf(">Facebook<");
    expect(googleAt).toBeGreaterThan(-1);
    expect(instagramAt).toBeGreaterThan(googleAt);
    expect(facebookAt).toBeGreaterThan(instagramAt);
    expect(html).toContain("from-purple-600");
    expect(html).toContain("bg-[#1877F2]");
    expect(html).toContain("#FFC107");
    expect(html).toContain(">Not connected<");
    expect(html).toContain(">Instagram<");
    expect(html).toContain(">Facebook<");
    expect(html).not.toContain(">—<");
    expect(html).not.toContain("Reviews summary");
  });

  it("renders a place with no photos", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ photos: [] })} />,
    );
    expect(html).toContain("Lupita");
    expect(html).toContain("Overview");
    expect(html).toContain("Menus");
    expect(html).toContain("Rewards");
    expect(html).toContain("Soon");
    expect(renderToStaticMarkup(<SoonScreen title="Menus" />)).toContain(
      "Menus is coming soon",
    );
    expect(renderToStaticMarkup(<SoonScreen title="Rewards" />)).toContain(
      "Rewards is coming soon",
    );
  });

  it("renders no outbound href when links and callbacks are absent", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile
        place={detail({
          website_url: "https://example.com",
          instagram_url: "https://instagram.com/lupita",
          phone: "+525500000000",
          lat: 19.4,
          lng: -99.1,
        })}
      />,
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("https://example.com");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('role="dialog"');
  });

  it("uses the overview threshold instead of the fallback 5", () => {
    const place = detail({ request_threshold: 12, request_count: 3, enriched_at: "" });
    expect(place.request_threshold).toBe(12);
    const html = renderToStaticMarkup(<PlaceProfile place={place} />);
    expect(html).toContain("3 of 12 votes");
  });

  it("does not treat a listed-false row as hidden", () => {
    const place = placeRowToDetail({
      id: "p-1",
      mesita_name: "Hidden",
      listed: false,
      enriched_at: "2026-01-01",
    });
    expect(place.name).toBe("Hidden");
  });
});
