// MESITA PREMIER (was Official: Pato, MESITA-2925, "Use the word Official. Kill Select
// and Boosted"; Premier since MESITA-2948). A
// place is Premier while guests back it with a paid tier,
// `places.boost_tier` 1 · 2, read as 2X · 5X (10X retired, MESITA-3041). The operator's
// Selected mark is gone; nothing else makes a place Premier.

/** The levels as a guest reads them, keyed by `boost_tier`. */
export const PREMIER_LEVELS: Readonly<Record<1 | 2, string>> = {
  1: "2X",
  2: "5X",
};

/** The place's Premier tier, 0 when it is not Premier. An absent or odd
 *  `boost_tier` reads as 0: understating beats promising a mark that is not
 *  there. */
export function premierTier(place: { boost_tier?: number | null }): 0 | 1 | 2 {
  const t = place.boost_tier;
  return t === 1 || t === 2 ? t : 0;
}

export function isPremierPlace(place: { boost_tier?: number | null }): boolean {
  return premierTier(place) > 0;
}

/** "2X", or null when the place is not Premier. */
export function premierLevel(tier: number | null | undefined): string | null {
  return tier === 1 || tier === 2 ? PREMIER_LEVELS[tier] : null;
}

/** The plan names a guest buys (MESITA-3063): 2X is "Premier", 5X is
 *  "Premier Max". The X stays the ranking priority, `premierLevel`. */
export const PREMIER_PLANS: Readonly<Record<1 | 2, string>> = {
  1: "Premier",
  2: "Premier Max",
};

/** "Premier Max", or null when the place is not Premier. */
export function premierLabel(tier: number | null | undefined): string | null {
  return tier === 1 || tier === 2 ? PREMIER_PLANS[tier] : null;
}
