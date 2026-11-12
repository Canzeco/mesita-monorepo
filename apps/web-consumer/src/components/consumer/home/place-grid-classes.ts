// PLACES 3.0'S BOXES (MESITA-3662, back in MESITA-3762), one source for the
// row card (PlaceRowCard) and its loading silhouette (RowFallback), so the
// places land where the silhouettes stood. A plain module: a server loading
// frame reads these strings too.

/** One column of rows beside the emoji rail (MESITA-3781); 12px sides and
 *  top, 10px between rows. The chip row that sat above it is gone. */
export const ROW_LIST = "grid grid-cols-1 content-start gap-2.5 px-3 pt-3";

/** The two squares side by side, touching: one card (Pato, MESITA-3664:
 *  "unify the left image with the right box … making the adjacent borders
 *  squared"). */
export const ROW_PAIR = "grid grid-cols-2";

/** The photo (never 4:3 here, MESITA-3675): 16px corners on the outer side
 *  only, stretched to the info box's height (a square, or taller when the
 *  facts need it, MESITA-3665). */
export const ROW_PHOTO =
  "bg-muted relative min-h-full overflow-hidden rounded-l-2xl";

/** The info box: a soft fill, 12px inside, 16px corners on the outer side
 *  only, the buttons pinned to its bottom so every row's buttons line up.
 *  At least square; it grows with its facts (an aspect-ratio box's minimum
 *  height is its content), and the photo grows with it. */
// bg-muted/80 (Pato, MESITA-3810: "a bit lighter again"): between
// MESITA-3805's bg-muted ("its too light") and the bg-muted/60 before it.
export const ROW_INFO =
  "bg-muted/80 relative flex aspect-square min-w-0 flex-col gap-1 rounded-r-2xl p-3";
