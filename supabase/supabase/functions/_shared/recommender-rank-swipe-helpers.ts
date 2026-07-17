// Ranking helpers for the consumer swipe deck pipeline
// (`recommender-rank-swipe.ts`): intent composition, tier boost, fallback
// ordering, and category diversification.

import {
  type ConsumerProfile,
  type PlaceRow,
} from "./recommender-pool.ts";
import { localHour } from "./local-time.ts";

const DEFAULT_RADIUS_KM = 25;

// Builds the one-line semantic query that gets embedded. The richer this
// is, the better the ranking — but we keep it terse so the embedding
// stays focused on the place-shaped signal.
export function composeIntent({
  profile,
  lat,
  lng,
  candidates,
}: {
  profile: ConsumerProfile | null;
  lat: number | null;
  lng: number | null;
  candidates: PlaceRow[];
}): string {
  const parts: string[] = [];
  // Time-of-day handle. The Edge runtime clock is UTC, so we convert to the
  // consumer's LOCAL hour from their longitude (see _shared/local-time.ts) —
  // otherwise a 5am Mexico morning reads as ~11am UTC and pitches brunch. Still
  // a flavour for the embedder, not a hard filter.
  const hour = localHour(lng);
  if (hour < 11) parts.push("morning coffee and brunch energy");
  else if (hour < 16) parts.push("lunch and afternoon hangout vibes");
  else if (hour < 20) parts.push("golden hour rooftops and early dinner");
  else parts.push("dinner, cocktails, and late-night spots");

  if (profile?.country) parts.push(`a consumer from ${profile.country}`);
  if (profile?.tier === "premium") {
    parts.push("a Mesita Premium member who values standout, high-quality places");
  }
  if (lat != null && lng != null) parts.push(`within ${DEFAULT_RADIUS_KM}km of this location`);

  const topCats = topCategoriesIn(candidates, 3);
  if (topCats.length) parts.push(`mixing ${topCats.join(", ")}`);

  parts.push("places with great vibe and worth the visit");
  return parts.join("; ");
}

export function topCategoriesIn(rows: PlaceRow[], k: number): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const c = (r.category ?? "").toLowerCase().trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([c]) => c);
}

// Premium overlay: stable partition that floats partner places above
// non-partners while preserving the relevance order inside each group. A
// no-op for free / anonymous, so the deck only changes for Premium members.
export function applyTierBoost(rows: PlaceRow[], tier: string | null): PlaceRow[] {
  if (tier !== "premium") return rows;
  const partners: PlaceRow[] = [];
  const rest: PlaceRow[] = [];
  for (const r of rows) {
    if (r.listing_type === "partner") partners.push(r);
    else rest.push(r);
  }
  return [...partners, ...rest];
}

export function fallbackRank(rows: PlaceRow[]): PlaceRow[] {
  // Partner-first, then newest. Stable when OpenAI is down.
  return [...rows].sort((a, b) => {
    const ap = a.listing_type === "partner" ? 0 : 1;
    const bp = b.listing_type === "partner" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return 0;
  });
}

// Cap the final deck so we don't return 50 identical "Italian" cards.
export function diversify(rows: PlaceRow[], limit: number, perCategory: number): PlaceRow[] {
  const out: PlaceRow[] = [];
  const seenCat = new Map<string, number>();
  const tail: PlaceRow[] = [];
  for (const r of rows) {
    if (out.length >= limit) break;
    const cat = (r.category ?? "").toLowerCase().trim();
    const count = seenCat.get(cat) ?? 0;
    if (cat && count >= perCategory) {
      tail.push(r);
      continue;
    }
    out.push(r);
    if (cat) seenCat.set(cat, count + 1);
  }
  for (const r of tail) {
    if (out.length >= limit) break;
    out.push(r);
  }
  return out;
}
