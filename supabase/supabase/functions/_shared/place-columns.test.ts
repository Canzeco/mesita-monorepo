import { assert } from "jsr:@std/assert@1";
import { PLACE_CARD_COLUMNS_ARRAY } from "./place-columns.ts";

// Worst-case fixture, derived from the REAL column list rather than a
// hand-picked subset (MESITA-1283) — a hand-typed fixture silently stops
// covering a column the moment place-columns.ts grows one, and this guard
// existed for months returning a false "under budget" before anyone
// noticed the card it was testing wasn't the one any endpoint sent. Every
// card column gets a long string (the single most conservative worst case a
// scalar/array column can hold — real values are almost all far shorter
// enums, numbers or short arrays), so this is an upper bound on the true
// payload, not a best-effort guess.
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
  // The five excluded jsonb keys, stuffed after the loop so they overwrite
  // any plain string it wrote. The card never reads them while they stay in
  // PLACE_CARD_EXCLUDED_COLUMNS; if details, products or google_reviews ever
  // leaves that set, its stuffed value lands in the card and pushes it past
  // the 50KB budget.
  row.details = { dining_style: big, service_options: Array(50).fill(big) };
  row.products = { menu: Array.from({ length: 100 }, () => ({ name: big, price: 100 })) };
  row.google_reviews = Array.from({ length: 50 }, () => ({ author: big, rating: 5, quote: big, date: "2026-01-01" }));
  row.menus = { legacy: big };
  row.popular_times = Array.from({ length: 7 }, () => ({ day: "Mon", range: big }));
  return row;
}

// Guard test 7 (MESITA-1247): the card is what a list/search/swipe surface
// pays for on every place, every request, so the PLACE_CARD_COLUMNS
// projection must stay small even when every column it keeps is stuffed.
Deno.test("PLACE_CARD_COLUMNS: stays under 50KB even with every real column stuffed and every heavy key stuffed", () => {
  const row = heavyFixtureRow();
  const card = Object.fromEntries(PLACE_CARD_COLUMNS_ARRAY.map((key) => [key, row[key]]));
  const size = new TextEncoder().encode(JSON.stringify(card)).length;
  assert(size < 50 * 1024, `card is ${size} bytes, budget is 50KB`);
});
