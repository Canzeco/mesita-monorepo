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

  it("a Mesita card still links to its page and can be saved", () => {
    const html = tile({});
    expect(html).toContain('href="/place/casa"');
    expect(html).not.toContain('aria-label="Open Casa"');
    expect(html).toContain("Add Casa to favorites");
  });
});

describe("a Google-only card's image is a placeholder, never a photo (MESITA-2298)", () => {
  it("ignores any photo on the wire", () => {
    const html = tile({
      id: "g:ChIJx",
      googleOnly: true,
      photos: ["https://lh3.googleusercontent.com/p"],
    });
    expect(html).not.toContain("<img");
  });

  it("a Mesita place still shows its stored photo", () => {
    const html = tile({ photos: ["https://example.com/a.jpg"] });
    expect(html).toContain("<img");
  });
});

describe("the tile shows only the facts the place has (MESITA-2645)", () => {
  it("hides what the place does not have — no invented cells", () => {
    const html = tile({});
    expect(html).not.toContain("Open");
    expect(html).not.toContain("Closed");
    expect(html).not.toContain(" km");
    expect(html).not.toContain("(0)");
  });
});

describe("Save and Share (MESITA-2650, MESITA-2668)", () => {
  it("sit outside the tile link, so a tap saves or shares and never navigates", () => {
    const html = tile({});
    expect(html).toContain("Share Casa");
    expect(html).toContain("Add Casa to favorites");
    // A sibling of the link, never inside it.
    const link = html.slice(html.indexOf("<a "), html.indexOf("</a>"));
    expect(link).not.toContain("data-tile-save");
    expect(link).not.toContain("data-tile-share");
  });
});
