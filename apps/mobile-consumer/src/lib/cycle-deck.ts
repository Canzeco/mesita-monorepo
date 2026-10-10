// THE DECK IS ALWAYS 50, CYCLED FROM WHATEVER IS REAL — web Scroll's rule
// (ScrollDeck.tsx `DECK_SIZE`, MESITA-1703), carried to the swipe deck in
// MESITA-2047. Pato, live: "the deck must be 50 items. then it repeats. if n
// is one, fill the 50 items deck with the same place."
//
// It cycles ONE source, never a mix: the real deck, or — while
// SCROLL_USES_MOCK is on (MESITA-2105, Pato, 2026-10-10: "for the moment use
// mock data written in the frontend") — the twelve shared mock places, which
// replace the real deck whole and never pad it.
//
// No imports, on purpose: `pnpm test` loads this file straight into Node.

/** Cards in a full deck. Cycled from the real rows until the catalog can fill it. */
export const DECK_SIZE = 50;

export function cycleDeck<T>(rows: readonly T[], size: number = DECK_SIZE): T[] {
  if (rows.length === 0) return [];
  return Array.from({ length: size }, (_, i) => rows[i % rows.length] as T);
}
