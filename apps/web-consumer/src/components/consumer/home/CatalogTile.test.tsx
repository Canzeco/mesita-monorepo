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

describe("the tile: photo on top, its light reflection below (MESITA-2369, MESITA-2373)", () => {
  it("shows the photo on the top 60%, uncovered, and mirrors it from its foot under 80% paper", () => {
    const html = tile({ photos: ["https://example.com/a.jpg"], price_level: 2 });
    expect(html).toContain("relative aspect-square min-w-0 overflow-hidden");
    expect(html).toContain("absolute inset-x-0 top-0 h-[60%] overflow-hidden");
    expect(html).toContain("absolute inset-x-0 bottom-0 h-[40%] overflow-hidden");
    expect(html).toContain("absolute inset-x-0 top-0 h-[150%] -scale-y-100");
    expect(html.match(/<img/g)?.length).toBe(2);
    expect(html).toContain("bg-paper/80");
    expect(html).not.toContain("bg-foreground/50");
    expect(html).not.toMatch(/rounded-(xl|2xl)/);
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(">Casa<"));
  });

  it("a Google card reflects its emoji tile, still with no photo", () => {
    const html = tile({ id: "g:ChIJx", googleOnly: true, family_keys: ["tacos"] });
    expect(html).not.toContain("<img");
    expect(html.match(/data-placeholder="emoji"/g)?.length).toBe(2);
  });
});

describe("the tile shows far more, all real (MESITA-2371)", () => {
  it("prints price · category, zone · time, stars · distance in Pato's order", () => {
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
    expect(html).toContain("4.6");
    expect(html).toContain("(812)");
    // Pato's order (MESITA-2374): name; price · category; zone · time;
    // stars · distance.
    expect(html).toMatch(/· Cafe</);
    expect(html).toContain("Tecnológico · Open · until 02:00");
    expect(html).toContain("1.4 km");
    expect(html.indexOf("Cafe<")).toBeLessThan(html.indexOf("Tecnológico"));
    expect(html.indexOf("Tecnológico")).toBeLessThan(html.indexOf("(812)"));
    expect(html.match(/<p /g)?.length).toBeLessThanOrEqual(4);
    expect(html).not.toContain("per person");
  });

  it("hides what the place does not have — no invented cells", () => {
    const html = tile({});
    expect(html).not.toContain("Open");
    expect(html).not.toContain("Closed");
    expect(html).not.toContain(" km");
    expect(html).not.toContain("(0)");
  });
});

describe("the Save heart sits at the right of the name row (MESITA-2374)", () => {
  it("is placed at the band's top-right, outside the tile link", () => {
    const html = tile({});
    expect(html).toContain("absolute top-[60%] right-0 flex h-11 w-11");
    // A sibling of the link, never inside it.
    const link = html.slice(html.indexOf("<a "), html.indexOf("</a>"));
    expect(link).not.toContain("data-tile-save");
  });
});
