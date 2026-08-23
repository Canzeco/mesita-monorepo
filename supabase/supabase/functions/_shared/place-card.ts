// _shared/place-card.ts
//
// The lightweight "card" projection of a place — guard test 7 (MESITA-1247):
// prove the card stays small even when every heavy jsonb column on the row
// is stuffed full, since the card is what a list/search surface pays for on
// every place, every request.
//
// WIRED (MESITA-1283): consumer-web-list-places and consumer-web-recommend-
// swipe both now select PLACE_CARD_COLUMNS (place-columns.ts) instead of
// PLACE_PUBLIC_COLUMNS — the only two consumer EFs that return MORE THAN ONE
// place per request. consumer-web-get-place (single-place detail) keeps the
// full projection; Memo's own supabase-edgefunc-search-places already had
// its own narrower MEMO_PLACE_PUBLIC_SELECT (memo-place-card.ts), untouched
// by this file.
//
// NOT the full Atlas SS C card/dossier system — this mirrors place-columns
// .ts's PLACE_CARD_COLUMNS verbatim (every public column except the five
// enrichment-filled jsonb ones), not a hand-picked subset. A prior version of
// this file DID hand-pick 13 fields, which would have dropped lat/lng,
// welcome/premium rates, status, hours and ~70 other columns the two real
// list/swipe EFs and their web-consumer client actually send and read today
// — verified before wiring, not assumed: apps/web-consumer's Place type (
// api/places.ts) declares ~50 fields beyond the old 13, and grepping the
// component tree confirmed the one heavy field the client DOES type
// (`products`, for the menu) is read only by place-detail/{tabs,menus}.tsx —
// the single-place dossier view, never the swipe deck or search/catalog
// cards — and that neither list/swipe EF has ever populated it.

import {
  PLACE_CARD_COLUMNS_ARRAY,
  PLACE_CARD_EXCLUDED_COLUMNS,
} from "./place-columns.ts";

/** Every public place column except the five heavy jsonb ones. */
export type PlaceCard = Record<
  (typeof PLACE_CARD_COLUMNS_ARRAY)[number],
  unknown
>;

export function buildPlaceCard(row: Record<string, unknown>): PlaceCard {
  const card = {} as Record<string, unknown>;
  for (const key of PLACE_CARD_COLUMNS_ARRAY) {
    if (PLACE_CARD_EXCLUDED_COLUMNS.has(key)) continue; // belt 2 — see test
    card[key] = row[key] ?? null;
  }
  return card as PlaceCard;
}
