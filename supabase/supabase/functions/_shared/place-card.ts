// _shared/place-card.ts
//
// The lightweight "card" projection of a place — guard test 7 (MESITA-1247):
// prove the card stays small even when every heavy jsonb column on the row
// is stuffed full, since the card is what a list/search surface pays for on
// every place, every request. Field list drawn from place-columns.ts's
// COLUMNS (the source of truth for a place read projection), deliberately
// excluding the five enrichment-filled jsonb columns it also carries
// (details, products, google_reviews, menus, popular_times).
//
// NOT the full Atlas SS C card/dossier system — the minimal slice needed to
// prove the size budget holds. A real dossier/card split is later work.
//
// REVIEW FINDING (MESITA-1247): `buildPlaceCard` is called ONLY by this
// file's own test — no list/search endpoint constructs a card through it
// today. `_shared/place-columns.ts`'s COLUMNS (the real read projection)
// still carries all five heavy jsonb columns, and
// `supabase-edgefunc-search-places/index.ts` — Memo's own data-access EF —
// projects through its own, narrower, unrelated `MEMO_PLACE_PUBLIC_SELECT`
// (`_shared/memo-place-card.ts`), untouched by this file. So: this guard
// pins a TARGET shape/budget for a card projection that doesn't exist in any
// live response yet — it is not, today, a regression guard on real payload
// size. If a future endpoint ships every heavy column in a list/search
// response, this test stays green and would give false confidence. Wiring
// a real endpoint onto this shape (or this shape onto a real endpoint) is
// the Atlas SS C card/dossier split referenced above — tracked as
// follow-up, not attempted here.

export type PlaceCard = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  category_label: string | null;
  price_level: number | null;
  status: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  mesita_stars_overall: number | null;
  mesita_review_count: number | null;
  photos: string[] | null;
  tags: string[] | null;
};

const CARD_FIELDS = [
  "id", "slug", "name", "category", "category_label", "price_level", "status",
  "google_stars_overall", "google_review_count", "mesita_stars_overall",
  "mesita_review_count", "photos", "tags",
] as const;

export function buildPlaceCard(row: Record<string, unknown>): PlaceCard {
  const card = {} as Record<string, unknown>;
  for (const key of CARD_FIELDS) card[key] = row[key] ?? null;
  return card as PlaceCard;
}
