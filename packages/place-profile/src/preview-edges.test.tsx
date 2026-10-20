import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceProfile } from "./components/PlaceProfile";
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
  it("keeps a long name and drops an unknown distance", () => {
    const name = "Casa de la Abuela Lupita y los Compadres del Centro Histórico";
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ mesita_name: name })} scrollLabel="Member profile preview" />,
    );
    expect(html).toContain(name);
    expect(html).not.toContain("- km");
    expect(html).toContain('aria-label="Member profile preview"');
    expect(html).not.toContain("Phone emulator");
  });

  it("is one scroll: no tab bar and nothing Soon (MESITA-2441)", () => {
    const html = renderToStaticMarkup(<PlaceProfile place={detail()} />);
    expect(html).not.toContain('aria-label="Place sections"');
    expect(html).not.toContain("Overview");
    expect(html).not.toContain("Rewards");
    expect(html).not.toContain(">Menu<");
    expect(html).not.toContain("Soon");
    expect(html).not.toContain("Pay");
  });

  it("orders the sections About, Hours, Location, Reviews, Links", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile
        place={detail({
          description: "A story.",
          hours: { monday: [{ open: "09:00", close: "17:00" }] },
          timezone: "America/Mexico_City",
          address: "Calle 1",
          lat: 19.4,
          lng: -99.1,
          google_reviews: [{ author: "Ana", rating: 5, text: "Great", published: "2026-10-01" }],
          website_url: "https://example.com",
        })}
      />,
    );
    const at = (title: string) => html.indexOf(`aria-label="${title}"`);
    const order = ["About", "Hours", "Location", "Reviews", "Links"].map(at);
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("puts the name, then one meta line, under the photos", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile
        place={{
          ...detail({
            photos: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
            price_level: 3,
            google_stars_overall: 4.6,
            google_review_count: 14818,
          }),
          distance_km: 2.4,
        }}
      />,
    );
    expect(html.indexOf("aspect-[4/3]")).toBeLessThan(html.indexOf("<h1"));
    const metaAt = html.indexOf('data-testid="place-meta"');
    const meta = html.slice(html.indexOf(">", metaAt) + 1);
    const text = meta.replace(/<[^>]+>/g, "");
    expect(text).toMatch(/^Restaurant·\$\$\$·2\.4 km·4\.6\(15K\)/);
  });

  it("leaves the social slot empty until it is passed (MESITA-2442)", () => {
    expect(renderToStaticMarkup(<PlaceProfile place={detail()} />)).not.toContain(
      'data-slot="social"',
    );
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail()} social={<span>Perdón and 3 others saw this</span>} />,
    );
    const slot = html.indexOf('data-slot="social"');
    expect(slot).toBeGreaterThan(html.indexOf('data-testid="place-meta"'));
    expect(slot).toBeLessThan(html.indexOf(">Save<"));
    expect(html).toContain("Perdón and 3 others saw this");
  });

  it("puts the Enrich vote under the actions when not enriched (MESITA-2332)", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ enriched_at: null, is_enriched: false })} />,
    );
    expect(html).toContain("Vote to enrich");
    expect(html.indexOf(">Directions<")).toBeLessThan(html.indexOf("Vote to enrich"));
    expect(html).not.toContain("Community votes");
  });

  it("shows Google's create-time reviews on the scroll of an unenriched place", () => {
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
    expect(html).toContain("Vote to enrich");
    expect(html).toContain("Great coffee");
    expect(html.indexOf("Vote to enrich")).toBeLessThan(html.indexOf("Great coffee"));
  });

  it("draws no Reviews section for a place Google gave none", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ enriched_at: null, is_enriched: false })} />,
    );
    expect(html).not.toContain('aria-label="Reviews"');
  });

  it("has Save · Share · Directions as icons and Reserve pinned at the bottom", () => {
    const html = renderToStaticMarkup(<PlaceProfile place={detail()} />);
    const save = html.indexOf(">Save<");
    const share = html.indexOf(">Share<");
    const directions = html.indexOf(">Directions<");
    expect(save).toBeGreaterThan(-1);
    expect(share).toBeGreaterThan(save);
    expect(directions).toBeGreaterThan(share);
    expect(html).not.toContain(">Contact<");
    const reserve = html.indexOf('aria-label="Reserve a table"');
    expect(reserve).toBeGreaterThan(directions);
    expect(html.lastIndexOf("sticky bottom-0", reserve)).toBeGreaterThan(-1);
    expect(html.match(/aria-label="Reserve a table"/g)).toHaveLength(1);
  });

  it("has no Reserve for a place that opted out of bookings", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ reservations_enabled: false })} />,
    );
    expect(html).not.toContain("Reserve a table");
  });

  it("renders a place with no photos", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ photos: [] })} />,
    );
    expect(html).toContain("Lupita");
    expect(html).toContain("bg-pink-gradient");
    expect(html).toContain(">Save<");
  });

  it("draws the map at the place's coordinates, keyless", () => {
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail({ address: "Calle 1", lat: 25.6779, lng: -100.3 })} />,
    );
    expect(html).toContain("https://tile.openstreetmap.org/16/");
    expect(html).toContain('aria-label="Map of Lupita"');
    expect(html).toContain("© OpenStreetMap contributors");
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

  it("renders the full About with no show-more control", () => {
    const capped = "A".repeat(500);
    const overOldClamp = "B".repeat(700);
    for (const text of [capped, overOldClamp]) {
      const html = renderToStaticMarkup(
        <PlaceProfile place={detail({ description: text })} />,
      );
      expect(html).toContain(">About<");
      expect(html).not.toContain("Presentation");
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
