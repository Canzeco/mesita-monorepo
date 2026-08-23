import { assert } from "jsr:@std/assert@1";
import { buildPlaceCard } from "./place-card.ts";

function heavyFixtureRow(): Record<string, unknown> {
  const big = "x".repeat(2000);
  return {
    id: "11111111-1111-1111-1111-111111111111", slug: "some-place", name: "Some Place",
    category: "restaurant", category_label: "Restaurant", price_level: 3, status: "OPERATIONAL",
    google_stars_overall: 4.5, google_review_count: 812, mesita_stars_overall: 4.7, mesita_review_count: 40,
    photos: Array.from({ length: 20 }, (_, i) => `https://example.com/photo-${i}.jpg`),
    tags: Array.from({ length: 30 }, (_, i) => `tag-${i}`),
    // Worst-case heavy jsonb — must never reach the card:
    details: { dining_style: big, service_options: Array(50).fill(big) },
    products: { menu: Array.from({ length: 100 }, () => ({ name: big, price: 100 })) },
    google_reviews: Array.from({ length: 50 }, () => ({ author: big, rating: 5, quote: big, date: "2026-01-01" })),
    menus: { legacy: big },
    popular_times: Array.from({ length: 7 }, () => ({ day: "Mon", range: big })),
  };
}

Deno.test("buildPlaceCard: excludes every heavy jsonb key", () => {
  const card = buildPlaceCard(heavyFixtureRow()) as unknown as Record<string, unknown>;
  for (const heavy of ["details", "products", "google_reviews", "menus", "popular_times"]) {
    assert(!(heavy in card), `card must not carry ${heavy}`);
  }
});

Deno.test("buildPlaceCard: stays under 50KB even with every heavy key stuffed", () => {
  const size = new TextEncoder().encode(JSON.stringify(buildPlaceCard(heavyFixtureRow()))).length;
  assert(size < 50 * 1024, `card is ${size} bytes, budget is 50KB`);
});
