// memo-place-card.ts — the ONE public place shape that crosses Memo's data wire.
//
// Memo never reads Postgres. Its data-access Edge Functions
// (supabase-edgefunc-recall-places / -search-places) own the SELECT and project
// every row down to this card before answering. That projection is the privacy
// boundary: it is a whitelist, so a column added to `places`/`projects_view`
// cannot leak into Memo's context by accident — someone has to widen this file
// on purpose.
//
// Deliberately ABSENT: embeddings, ranker internals, owner/account linkage,
// contact endpoints, billing, and every user-scoped field. What survives is
// exactly what a place card shows a stranger.


// The columns the data EFs may SELECT. Kept beside the card so the projection
// and the query can never drift apart.
export const MEMO_PLACE_PUBLIC_SELECT =
  "id, slug, name, google_name, address, category, listing_type, google_place_id, google_stars_overall";

export type MemoPlaceCard = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  category: string | null;
  listingType: string | null;
  googlePlaceId: string | null;
  rating: number | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Catalog row → public card. Reads defensively: the pool rows carry an index
// signature that types most of these `unknown`.
export function rowToMemoPlaceCard(row: Record<string, unknown>): MemoPlaceCard {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    // `name` is the generated display column (mesita_name → google_name).
    name: String(row.name ?? ""),
    address: str(row.address),
    category: str(row.category),
    listingType: str(row.listing_type),
    googlePlaceId: str(row.google_place_id),
    rating: num(row.google_stars_overall),
  };
}

// Re-parse a card that arrived over the internal wire. The response is trusted
// (service-role, gateway-verified) but shape-checking here keeps a malformed
// row from reaching the model as `undefined · undefined`.
export function parseMemoPlaceCards(raw: unknown): MemoPlaceCard[] {
  if (!Array.isArray(raw)) return [];
  const out: MemoPlaceCard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = str(r.name);
    if (!name) continue; // a nameless card is not showable
    out.push({
      id: String(r.id ?? ""),
      slug: String(r.slug ?? ""),
      name,
      address: str(r.address),
      category: str(r.category),
      listingType: str(r.listingType),
      googlePlaceId: str(r.googlePlaceId),
      rating: num(r.rating),
    });
  }
  return out;
}
