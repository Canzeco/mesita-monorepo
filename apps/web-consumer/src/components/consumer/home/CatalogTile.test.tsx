import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { Place } from "@/lib/api/places";
import { CatalogTile } from "./CatalogTile";

function tile(over: Partial<Place>) {
  const place = {
    id: "p1",
    slug: "casa",
    name: "Casa",
    category: "restaurant",
    photos: [],
    ...over,
  } as Place;
  return renderToStaticMarkup(
    <CatalogTile place={place} saved={false} onToggle={() => {}} />,
  );
}

describe("the Enriched mark on a catalog card", () => {
  it("follows an enriched place's name (MESITA-2628)", () => {
    const html = tile({ enriched: true });
    expect(html).toContain('aria-label="Enriched"');
    expect(html.indexOf(">Casa<")).toBeLessThan(
      html.indexOf('aria-label="Enriched"'),
    );
  });

  it("never shows on a Created place", () => {
    expect(tile({ enriched: false })).not.toContain('aria-label="Enriched"');
  });
});

describe("a Google-only card opens its profile, never Google Maps (MESITA-2298)", () => {
  it("is a button that hands the explicit open to the parent", () => {
    const html = tile({
      id: "g:ChIJx",
      slug: "ChIJx",
      google_place_id: "ChIJx",
      googleOnly: true,
    });
    expect(html).not.toContain("google.com/maps");
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain('href="/place/');
    expect(html).toContain('aria-label="Open Casa"');
  });

  it("has no save heart", () => {
    expect(tile({ id: "g:ChIJx", googleOnly: true })).not.toContain(
      "Add Casa to favorites",
    );
  });

  it("a Mesita card still links to its page and can be saved", () => {
    const html = tile({});
    expect(html).toContain('href="/place/casa"');
    expect(html).not.toContain('aria-label="Open Casa"');
    expect(html).toContain("Add Casa to favorites");
  });
});

describe("a Google-only card's image is a placeholder, never a photo (MESITA-2298)", () => {
  it("draws the family's line icon, not its emoji, and ignores any photo on the wire (MESITA-2478)", () => {
    const html = tile({
      id: "g:ChIJx",
      googleOnly: true,
      family_keys: ["tacos"],
      photos: ["https://lh3.googleusercontent.com/p"],
    });
    expect(html).not.toContain("<img");
    expect(html).toContain('data-placeholder="family"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toContain("🌮");
  });

  it("falls back to the initial when no family resolves", () => {
    const html = tile({ id: "g:ChIJx", googleOnly: true, family_keys: [] });
    expect(html).toContain('data-placeholder="initial"');
    expect(html).toContain(">C<");
  });

  it("a Mesita place still shows its stored photo", () => {
    const html = tile({ photos: ["https://example.com/a.jpg"] });
    expect(html).toContain("<img");
  });
});

describe("the tile shows the header's fields, Pato's order (MESITA-2645)", () => {
  it("prints name; category · $$ · stars; hours · distance — dollar signs, never a peso range, no zone", () => {
    const html = tile({
      price_level: 2,
      currency: "MXN",
      google_stars_overall: 4.6,
      google_review_count: 812,
      category_label: "Cafe",
      zone: "Tecnológico",
      open_now: true,
      closes_at: "02:00",
      distance_km: 1.4,
    } as Partial<Place>);
    expect(html).toContain("Cafe · $$<");
    expect(html).toContain("4.6");
    expect(html).toContain("(812)");
    expect(html).toContain("Open · until 02:00 · 1.4 km");
    expect(html.indexOf(">Casa<")).toBeLessThan(html.indexOf("Cafe · $$"));
    expect(html.indexOf("Cafe · $$")).toBeLessThan(html.indexOf("(812)"));
    expect(html.indexOf("(812)")).toBeLessThan(html.indexOf("Open · until"));
    expect(html).not.toContain("MX$");
    expect(html).not.toContain("Tecnológico");
    expect(html.match(/<p /g)?.length).toBeLessThanOrEqual(3);
  });

  it("hides what the place does not have — no invented cells", () => {
    const html = tile({});
    expect(html).not.toContain("Open");
    expect(html).not.toContain("Closed");
    expect(html).not.toContain(" km");
    expect(html).not.toContain("(0)");
  });
});

describe("Like and Share (MESITA-2650)", () => {
  it("sit outside the tile link, so a tap likes or shares and never navigates", () => {
    const html = tile({});
    expect(html).toContain("Share Casa");
    expect(html).toContain("Add Casa to favorites");
    // A sibling of the link, never inside it.
    const link = html.slice(html.indexOf("<a "), html.indexOf("</a>"));
    expect(link).not.toContain("data-tile-save");
    expect(link).not.toContain("data-tile-share");
  });
});
