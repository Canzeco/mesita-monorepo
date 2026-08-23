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
