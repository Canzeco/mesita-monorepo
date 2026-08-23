import { assert } from "jsr:@std/assert@1";
import { buildPlaceCard } from "./place-card.ts";
import {
  PLACE_CARD_COLUMNS_ARRAY,
  PLACE_CARD_EXCLUDED_COLUMNS,
} from "./place-columns.ts";

// Worst-case fixture, derived from the REAL column list rather than a
// hand-picked subset (MESITA-1283) — a hand-typed fixture silently stops
// covering a column the moment place-columns.ts grows one, and this file
// existed for months returning a false "under budget" before anyone
// noticed the card it was testing wasn't the one any endpoint sent. Every
// non-excluded column gets a long string (the single most conservative
// worst case a scalar/array column can hold — real values are almost all
// far shorter enums, numbers or short arrays), so this is an upper bound
// on the true payload, not a best-effort guess.
function heavyFixtureRow(): Record<string, unknown> {
  const big = "x".repeat(500);
  const row: Record<string, unknown> = {};
  for (const key of PLACE_CARD_COLUMNS_ARRAY) {
    if (key === "photos") {
      row[key] = Array.from({ length: 20 }, (_, i) => `https://example.com/photo-${i}.jpg`);
    } else if (key === "tags") {
      row[key] = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
    } else {
      row[key] = big;
    }
  }
  // Worst-case heavy jsonb — must never reach the card:
  row.details = { dining_style: big, service_options: Array(50).fill(big) };
  row.products = { menu: Array.from({ length: 100 }, () => ({ name: big, price: 100 })) };
  row.google_reviews = Array.from({ length: 50 }, () => ({ author: big, rating: 5, quote: big, date: "2026-01-01" }));
  row.menus = { legacy: big };
  row.popular_times = Array.from({ length: 7 }, () => ({ day: "Mon", range: big }));
  return row;
}

Deno.test("buildPlaceCard: excludes every heavy jsonb key", () => {
  const card = buildPlaceCard(heavyFixtureRow()) as unknown as Record<string, unknown>;
  for (const heavy of PLACE_CARD_EXCLUDED_COLUMNS) {
    assert(!(heavy in card), `card must not carry ${heavy}`);
  }
});

Deno.test("buildPlaceCard: carries every real card column, nothing dropped silently", () => {
  const card = buildPlaceCard(heavyFixtureRow()) as unknown as Record<string, unknown>;
  for (const key of PLACE_CARD_COLUMNS_ARRAY) {
    assert(key in card, `card is missing real column: ${key}`);
  }
  assert(
    Object.keys(card).length === PLACE_CARD_COLUMNS_ARRAY.length,
    "card must carry exactly the real card columns, no more, no fewer",
  );
});

Deno.test("buildPlaceCard: stays under 50KB even with every real column stuffed and every heavy key stuffed", () => {
  const size = new TextEncoder().encode(JSON.stringify(buildPlaceCard(heavyFixtureRow()))).length;
  assert(size < 50 * 1024, `card is ${size} bytes, budget is 50KB`);
});
