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
    expect(html).toContain("rounded-full bg-[#EA4335] h-6 w-6");
    expect(html).toContain("h-[18px] w-[18px]");
    expect(html).toContain('class="h-3 w-3"');
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
    const nav = html.slice(html.indexOf("<nav"), html.indexOf(">", html.indexOf("<nav")) + 1);
    expect(nav).toContain('aria-label="Place sections"');
    expect(nav).toContain("bg-card");
    expect(nav).not.toContain("bg-background");
    const saveAt = html.indexOf(">Save<");
    const contactAt = html.indexOf(">Contact<");
    const shareAt = html.indexOf(">Share<");
    const reserveAt = html.indexOf("Reserve a table");
    const payAt = html.indexOf("Pay, Soon");
    expect(saveAt).toBeGreaterThan(-1);
    expect(contactAt).toBeGreaterThan(saveAt);
    expect(shareAt).toBeGreaterThan(contactAt);
    expect(reserveAt).toBeGreaterThan(shareAt);
    expect(payAt).toBeGreaterThan(reserveAt);
    expect(html).not.toContain("Save, Soon");
    expect(html).toContain("Menu");
    expect(html).not.toContain("Menus");
    expect(html).toContain("Rewards");
    expect(html).toContain("Soon");
    const menuSoon = renderToStaticMarkup(<SoonScreen title="Menu" />);
    expect(menuSoon).toContain("Menu is coming soon");
    expect(menuSoon).toContain("Menu at this place lands here shortly.");
    expect(menuSoon).not.toContain("Menus");
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

  it("renders the full Presentation with no show-more control", () => {
    const capped = "A".repeat(500);
    const overOldClamp = "B".repeat(700);
    for (const text of [capped, overOldClamp]) {
      const html = renderToStaticMarkup(
        <PlaceProfile place={detail({ description: text })} />,
      );
      expect(html).toContain("Presentation");
      expect(html).toContain(text);
      expect(html).not.toContain("Show more");
      expect(html).not.toContain("Show less");
      expect(html).not.toContain("line-clamp");
    }
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
