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
  it("follows an enriched place's name", () => {
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

describe("a Google-only card (Right Now from Google)", () => {
  it("opens Google Maps in a new tab, never a Mesita page", () => {
    const html = tile({
      id: "g:ChIJx",
      slug: "ChIJx",
      google_place_id: "ChIJx",
      googleOnly: true,
    });
    expect(html).toContain(
      'href="https://www.google.com/maps/search/?api=1&amp;query=Casa&amp;query_place_id=ChIJx"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('href="/place/');
  });

  it("has no save heart", () => {
    expect(tile({ id: "g:ChIJx", googleOnly: true })).not.toContain(
      "Save Casa",
    );
  });

  it("a Mesita card still links to its page and can be saved", () => {
    const html = tile({});
    expect(html).not.toContain("google.com/maps");
    expect(html).toContain("Save Casa");
  });
});

describe("a Google-only card's image is a placeholder, never a photo (MESITA-2298)", () => {
  it("draws the family emoji and ignores any photo on the wire", () => {
    const html = tile({
      id: "g:ChIJx",
      googleOnly: true,
      family_keys: ["tacos"],
      photos: ["https://lh3.googleusercontent.com/p"],
    });
    expect(html).not.toContain("<img");
    expect(html).toContain('data-placeholder="emoji"');
    expect(html).toContain("🌮");
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
