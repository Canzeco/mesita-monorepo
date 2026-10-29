// THE HOME TILE'S BOXES, ONE SOURCE (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): CatalogTile
// and its loading silhouette (CatalogTileSkeleton, DiscoverFallback.tsx)
// read these strings, so the loading tile cannot drift from the loaded one.
// Layout only: each caller adds its own fill (the photo's grey, the ink).

/** EVERY TILE IS SQUARE (MESITA-2652), rounded-2xl, edged by a shadow,
 *  not a line (Pato, MESITA-2838: "I don't like the borders of the items
 *  here in home"; the MESITA-2661 grey hairline). The shadow is
 *  shadow-float, a tight dark edge plus a soft spread (Pato, MESITA-3065:
 *  "places must have maybe a stronger shadow"): shadow-rest's edge vanished
 *  on the grey page. */
export const TILE_FRAME =
  "relative isolate aspect-square min-w-0 overflow-hidden rounded-2xl shadow-float";

/** The photo, the top 60% (Pato, MESITA-2655: "better 40% and 60%, and use
 *  the space for 4 rows"). It carries the radius itself, as the band does:
 *  a child layer can escape the parent's rounded clip (MESITA-2429). */
export const TILE_PHOTO =
  "absolute inset-x-0 top-0 h-[60%] overflow-hidden rounded-t-2xl";

/** The bottom 40%, a plain white band (MESITA-2658: no reflection). */
export const TILE_BAND =
  "bg-paper absolute inset-x-0 bottom-0 h-[40%] overflow-hidden rounded-b-2xl";

/** The band's three 20px rows, 2px apart, 12px side padding, centred in
 *  what Save · Share leave: pb-11 is the 32px row and its 12px foot, so the
 *  gap over the name and the gap over the buttons match (MESITA-2645). */
export const TILE_TEXT =
  "relative flex h-full flex-col justify-center gap-0.5 px-3 pb-11";

/** Save · Share, 12px from the tile's sides AND its foot (MESITA-2668: "its
 *  not the same vertical margin as horizontal margin"). */
export const TILE_ACTIONS = "absolute inset-x-3 bottom-3";
