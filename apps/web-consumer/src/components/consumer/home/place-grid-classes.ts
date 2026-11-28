// PLACES 3.0'S BOXES (MESITA-3662, back in MESITA-3762), one source for the
// row card (PlaceRowCard) and its loading silhouette (RowFallback), so the
// places land where the silhouettes stood. A plain module: a server loading
// frame reads these strings too.

/** One column of rows, full width under the family strip (MESITA-4410): each
 *  row is HALF PHOTO, HALF INFO (ROW_PAIR). ONE 8px step
 *  (MESITA-4035, Pato: "make all margins smaller and same size"): the same
 *  on every side of the list, between rows, and inside a row. */
export const ROW_LIST = "grid grid-cols-1 content-start gap-2 p-2";

/** The two squares side by side, touching: one card (Pato, MESITA-3664:
 *  "unify the left image with the right box … making the adjacent borders
 *  squared"). */
export const ROW_PAIR = "grid grid-cols-2";

/** The photo (never 4:3 here, MESITA-3675): 16px corners on the outer side
 *  only, stretched to the info box's height (a square, or taller when the
 *  facts need it, MESITA-3665). */
export const ROW_PHOTO =
  "bg-muted relative min-h-full overflow-hidden rounded-l-2xl";

/** the info box: a soft fill, 8px inside, 16px corners on the outer side
 *  only, the buttons pinned to its bottom so every row's buttons line up.
 *  The photo's square is the minimum (ROW_PHOTO); this side grows with its
 *  facts and its buttons (MESITA-5024). An aspect-ratio on this box held
 *  the height and laid Save · Share on the bottom border. ONE 8px step on
 *  every side (Pato, MESITA-5062: "bottom and lateral margins of share and
 *  save buttons must be the same"); the Premier pill sits the same step in
 *  from the photo's top-left corner. */
// bg-muted/80 (Pato, MESITA-3810: "a bit lighter again"): between
// MESITA-3805's bg-muted ("its too light") and the bg-muted/60 before it.
// WHITE WITH A BORDER (Pato, 2026-11-18, MESITA-4432: "remove gray boxes.
// only white. white background for items with borders"): no grey fill; a
// hairline on the three outer sides, none where it meets the photo.
export const ROW_INFO =
  "bg-card border-border relative flex min-w-0 flex-col gap-2 rounded-r-2xl border border-l-0 p-2";
