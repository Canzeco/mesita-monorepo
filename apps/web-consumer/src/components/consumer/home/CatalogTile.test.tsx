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

describe("the Enrich vote on a catalog card", () => {
  it("rides a Created place's photo", () => {
    const html = tile({ enriched: false });
    expect(html).toContain('aria-label="Vote to enrich Casa"');
    expect(html).toContain(">Enrich<");
  });

  it("never shows on an enriched place", () => {
    const html = tile({ enriched: true });
    expect(html).not.toContain("Vote to enrich");
  });

  it("is a sibling of the photo link, never nested inside it", () => {
    const html = tile({ enriched: false });
    const link = html.indexOf("<a ");
    const linkEnd = html.indexOf("</a>", link);
    const button = html.indexOf('aria-label="Vote to enrich Casa"');
    expect(button).toBeGreaterThan(linkEnd);
  });
});
