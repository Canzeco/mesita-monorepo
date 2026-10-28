// MESITA OFFICIAL (Pato, MESITA-2925: "Use the word Official. Kill Select
// and Boosted. Just Official for the moment, and mention the level"). A
// place is Official while guests back it with a paid tier,
// `places.boost_tier` 1 · 2 · 3, read as 2X · 5X · 10X. The operator's
// Selected mark is gone; nothing else makes a place Official.

/** The levels as a guest reads them, keyed by `boost_tier`. */
export const OFFICIAL_LEVELS: Readonly<Record<1 | 2 | 3, string>> = {
  1: "2X",
  2: "5X",
  3: "10X",
};

/** The place's Official tier, 0 when it is not Official. An absent or odd
 *  `boost_tier` reads as 0: understating beats promising a mark that is not
 *  there. */
export function officialTier(place: { boost_tier?: number | null }): 0 | 1 | 2 | 3 {
  const t = place.boost_tier;
  return t === 1 || t === 2 || t === 3 ? t : 0;
}

export function isOfficialPlace(place: { boost_tier?: number | null }): boolean {
  return officialTier(place) > 0;
}

/** "2X", or null when the place is not Official. */
export function officialLevel(tier: number | null | undefined): string | null {
  return tier === 1 || tier === 2 || tier === 3 ? OFFICIAL_LEVELS[tier] : null;
}

/** "Official 2X", or null when the place is not Official. */
export function officialLabel(tier: number | null | undefined): string | null {
  const level = officialLevel(tier);
  return level ? `Official ${level}` : null;
}
