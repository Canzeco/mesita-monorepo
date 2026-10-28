import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceProfile } from "./components/PlaceProfile";
import { SoonScreen } from "./components/place-detail/soon-screen";
import { placeRowToDetail } from "./place-to-detail";
import type { PlaceDetail } from "./place-detail";

function detail(over: Record<string, unknown> = {}): PlaceDetail {
  return placeRowToDetail({
    id: "p-1",
    name: "Lupita",
    enriched_at: "2026-01-01T00:00:00Z",
    category_label: "Restaurant",
    reservations_enabled: true,
    ...over,
  });
}

describe("member preview edges", () => {
  it("keeps a long name and drops an unknown distance", () => {
    const name = "Casa de la Abuela Lupita y los Compadres del Centro Histórico";
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ name: name })} scrollLabel="Member profile preview" />,
    );
    expect(html).toContain(name);
    expect(html).not.toContain("- km");
    expect(html).toContain('aria-label="Member profile preview"');
    expect(html).not.toContain("Phone emulator");
  });

  it("keeps the four sections when not enriched, with no vote (MESITA-2332, MESITA-2642)", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ enriched_at: null, is_enriched: false })} />,
    );
    expect(html).toContain('aria-label="Place sections"');
    for (const label of ["Overview", "Reviews", "Products", "Premier"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain(">Enrich<");
    // Views enrich a place now; the guest never votes (MESITA-2642).
    expect(html).not.toContain("Vote to enrich");
    expect(html).not.toContain("Community votes");
  });

  it("keeps Google's create-time reviews on the Reviews tab, not on Overview", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile
        place={detail({
          enriched_at: null,
          is_enriched: false,
          google_review_count: 412,
          google_reviews: [
            { author: "Ana", rating: 5, quote: "Great coffee", date: "a week ago" },
            { author: "Luis", rating: 3, quote: "Slow line", date: "2 weeks ago" },
          ],
        })}
      />,
    );
    // MESITA-2332: Overview opens; the Details reviews wait on Reviews.
    expect(html).not.toContain("Great coffee");
    expect(html).toContain('aria-label="Place sections"');
  });

  it("draws no reviews list for an unenriched place Google gave none", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ enriched_at: null, is_enriched: false })} />,
    );
    expect(html).not.toContain('aria-label="Reviews"');
  });

  it("puts two action rows in the header and no pinned bar (MESITA-2321, MESITA-2633)", () => {
    const html = renderToStaticMarkup(<PlaceProfile place={detail()} />);
    for (const label of [
      "Reserve a table",
      "Directions in Google Maps",
      'aria-label="Add to favorites"',
      'aria-label="Contact"',
    ]) {
      expect(html).toContain(label);
    }
    // Share is on the first row again (MESITA-2633); the dots report
    // (MESITA-2684).
    expect(html).toContain('aria-label="Share"');
    expect(html).toContain('aria-label="More options"');
    // Reserve is a tile, no times on the profile (MESITA-2633, MESITA-2688):
    // fixed times read as confirmed availability.
    expect(html).toContain('aria-label="Reserve a table"');
    expect(html).not.toContain("data-reserve-slot");
    // Directions routes to the place (lib/maps-link.ts).
    expect(html).toContain("google.com/maps/dir/?api=1&amp;destination=");
    // Pay is back as a Soon tile beside Reserve (MESITA-2688).
    expect(html).toContain('aria-label="Pay, Soon"');
    // The old pinned band (border-t + backdrop-blur under the scroller) is gone.
    expect(html).not.toContain("backdrop-blur");
  });

  it("has no I went, even with every member action passed (MESITA-2567)", () => {
    const noop = () => {};
    const html = renderToStaticMarkup(
      <PlaceProfile
        place={detail()}
        actions={{ onSave: noop, onContact: noop, onShare: noop, onReserve: noop }}
      />,
    );
    expect(html).not.toMatch(/I went|went here/);
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
    expect(html).toContain("3.8 ★ (484)");
    expect(html).toContain("Instagram, not connected");
    expect(html).toContain("Facebook, not connected");
    const googleAt = html.indexOf("3.8 ★ (484)");
    const instagramAt = html.indexOf(">Instagram<");
    const facebookAt = html.indexOf(">Facebook<");
    expect(googleAt).toBeGreaterThan(-1);
    expect(instagramAt).toBeGreaterThan(googleAt);
    expect(facebookAt).toBeGreaterThan(instagramAt);
    expect(html).toContain("from-purple-600");
    expect(html).toContain("bg-[#1877F2]");
    expect(html).toContain('fill="#4285F4"');
    expect(html).toContain(">-<");
    expect(html).not.toContain(">Not connected<");
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
    const reserveAt = html.indexOf("Reserve a table");
    const directionsAt = html.indexOf("Directions in Google Maps");
    const saveAt = html.indexOf('aria-label="Add to favorites"');
    const contactAt = html.indexOf('aria-label="Contact"');
    const shareAt = html.indexOf('aria-label="Share"');
    // Row 1: Like · Directions · Contact · Share; row 2: Reserve (MESITA-2633).
    expect(saveAt).toBeGreaterThan(-1);
    expect(directionsAt).toBeGreaterThan(saveAt);
    expect(contactAt).toBeGreaterThan(directionsAt);
    expect(shareAt).toBeGreaterThan(contactAt);
    expect(reserveAt).toBeGreaterThan(shareAt);
    expect(html).not.toContain("Save, Soon");
    expect(html).toContain("Products");
    expect(html).not.toContain(">Menu<");
    expect(html).toContain("Premier");
    // No Soon pill in the strip (MESITA-2631); the screen says it.
    expect(html.slice(html.indexOf('aria-label="Place sections"'), html.indexOf("</nav>"))).not.toContain("Soon");
    const soon = renderToStaticMarkup(<SoonScreen />);
    expect(soon).toContain("Products &amp; Rewards are coming soon");
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

  it("carries the overview threshold, and prints no vote count (MESITA-2642)", () => {
    const place = detail({ request_threshold: 12, request_count: 3, enriched_at: "" });
    expect(place.request_threshold).toBe(12);
    const html = renderToStaticMarkup(<PlaceProfile place={place} />);
    expect(html).not.toContain("3 of 12");
  });

  it("does not treat a listed-false row as hidden", () => {
    const place = placeRowToDetail({
      id: "p-1",
      name: "Hidden",
      listed: false,
      enriched_at: "2026-01-01",
    });
    expect(place.name).toBe("Hidden");
  });
});
