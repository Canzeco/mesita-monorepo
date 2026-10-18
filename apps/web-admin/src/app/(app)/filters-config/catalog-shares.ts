// Display twin of catalogRelativeExponents in
// supabase/functions/_shared/discovery-config.ts. The contract test
// asserts these two functions agree. The shared engine's Mesita Selected
// scope (`scopeWeights("selected")` in `_shared/nearby-lineup.ts`) multiplies
// exactly these two keys, on the Map and on the Feed's Mesita Selected and
// family rails; this file only labels the form. Enriched is the gate, not a
// weight (every Selected row carries it), and Randomness is pinned to 0 (a
// shuffled pin is a moved pin, and Map and Feed share one order). Both stay
// stored on `catalog.ranking`, so a save drops nothing.

export const CATALOG_LIVE_RANK_KEYS = [
  "proximity",
  "popularity",
] as const;

export type CatalogLiveRankKey = (typeof CATALOG_LIVE_RANK_KEYS)[number];

export const CATALOG_ALL_ZERO_ERROR =
  "At least one Catalog signal must have a weight above zero.";

export const CATALOG_LIVE_SIGNAL_COPY: Record<
  CatalogLiveRankKey,
  { label: string }
> = {
  proximity: { label: "Proximity" },
  popularity: { label: "Popularity" },
};

export function catalogRelativeExponents(
  ranking: Partial<Record<CatalogLiveRankKey, number>>,
): Record<CatalogLiveRankKey, number> {
  const out = {} as Record<CatalogLiveRankKey, number>;
  let sum = 0;
  for (const key of CATALOG_LIVE_RANK_KEYS) {
    const w = ranking[key];
    if (typeof w === "number" && Number.isFinite(w) && w > 0) sum += w;
  }
  for (const key of CATALOG_LIVE_RANK_KEYS) {
    const w = ranking[key];
    const on = typeof w === "number" && Number.isFinite(w) && w > 0;
    out[key] = sum > 0 && on ? w / sum : 0;
  }
  return out;
}

export function catalogLiveWeightsAllZero(
  ranking: Partial<Record<CatalogLiveRankKey, number>>,
): boolean {
  return CATALOG_LIVE_RANK_KEYS.every((key) => {
    const w = ranking[key];
    return !(typeof w === "number" && Number.isFinite(w) && w > 0);
  });
}

/** "Off" at zero. Otherwise one decimal, so 1 and 1 read as 50%. */
export function catalogShareLabel(share: number): string {
  if (!(share > 0)) return "Off";
  const pct = Math.round(share * 1000) / 10;
  return `${pct}%`;
}
