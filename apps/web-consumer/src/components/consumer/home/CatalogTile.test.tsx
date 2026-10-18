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
      "Save Casa",
    );
  });

  it("a Mesita card still links to its page and can be saved", () => {
    const html = tile({});
    expect(html).toContain('href="/place/casa"');
    expect(html).not.toContain('aria-label="Open Casa"');
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

describe("the tile is an Instagram grid square (MESITA-2364)", () => {
  it("fills the square with the photo and lays the info on a solid white band", () => {
    const html = tile({ photos: ["https://example.com/a.jpg"], price_level: 2 });
    expect(html).toContain("aspect-square");
    expect(html.match(/<img/g)?.length).toBe(1);
    expect(html).toContain("data-tile-info");
    // A solid white band, no gradient (MESITA-2365).
    expect(html).toContain('class="bg-card absolute inset-x-0 bottom-0 px-1.5 py-1"');
    expect(html).not.toContain("bg-gradient-to-t");
    expect(html).not.toContain("-scale-y-100");
    expect(html).not.toMatch(/rounded-(lg|xl|2xl)/);
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(">Casa<"));
  });

  it("a Google card fills the square with its emoji tile, still no photo", () => {
    const html = tile({ id: "g:ChIJx", googleOnly: true, family_keys: ["tacos"] });
    expect(html).not.toContain("<img");
    expect(html.match(/data-placeholder="emoji"/g)?.length).toBe(1);
  });
});
