// RN has no CSS grid, so two-column layouts chunk their items into pairs and
// render each pair as a flex-row. That yields exact halves with a real gap,
// which percentage widths can't do without calc().
//
// Shared by the Favorites and Catalog grids — both render the same
// FavoriteTile at the same two-up rhythm, and a private copy in each drifted
// the moment one of them grew an odd-count spacer and the other didn't.

/** Chunk items into rows of two, preserving order. */
export function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}
