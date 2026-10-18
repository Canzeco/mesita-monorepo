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

describe("the card is one square: photo half, info half (MESITA-2344, MESITA-2360)", () => {
  it("is aspect-square with an h-1/2 photo over an h-1/2 band", () => {
    const html = tile({ photos: ["https://example.com/a.jpg"] });
    expect(html).toContain("aspect-square");
    expect(html).not.toContain("aspect-[3/2]");
    expect(html.match(/h-1\/2/g)?.length).toBe(2);
    expect(html).not.toContain("h-2/3");
    expect(html).not.toContain("h-1/3");
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(">Casa<"));
  });
});

describe("the info band is the photo's reflection under 50% ink (MESITA-2363)", () => {
  it("draws the image again, flipped, under a 50% ink layer, with paper text", () => {
    const html = tile({ photos: ["https://example.com/a.jpg"] });
    expect(html.match(/<img/g)?.length).toBe(2);
    expect(html).toContain("-scale-y-100");
    expect(html).toContain("bg-foreground/50");
    expect(html).toContain("data-card-reflection");
    expect(html).toContain("text-paper");
  });

  it("a Google card reflects its emoji tile, still with no photo", () => {
    const html = tile({ id: "g:ChIJx", googleOnly: true, family_keys: ["tacos"] });
    expect(html).not.toContain("<img");
    expect(html.match(/data-placeholder="emoji"/g)?.length).toBe(2);
  });
});
