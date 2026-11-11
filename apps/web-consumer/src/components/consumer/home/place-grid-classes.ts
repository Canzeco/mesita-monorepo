// The Places grid's boxes (MESITA-3658), one source for the card
// (PlaceGridCard) and its loading silhouette (DiscoverFallback), so the
// places land where the silhouettes stood. A plain module: a server loading
// frame reads these strings too.

/** Always two columns (MESITA-3660: a viewport `sm:` drew three inside the
 *  phone frame on desktop); 12px sides, 10px between columns, 16px between
 *  rows. */
export const GRID_LIST =
  "grid grid-cols-2 content-start gap-x-2.5 gap-y-4 px-3 pt-1";

/** The square photo, 12px corners (4:3 is Places 1.0 and 4.0 only,
 *  MESITA-3675). */
export const GRID_PHOTO =
  "bg-muted relative aspect-square overflow-hidden rounded-xl";

/** The two lines under the photo: the name's 20px line, the facts' 16px. */
export const GRID_TEXT = "flex flex-col pt-1.5";
export const GRID_NAME_LINE = "h-5";
export const GRID_FACT_LINE = "h-4";

/** The family chip row over the grid: one scrolling line, 12px sides. */
export const GRID_CHIPS =
  "scrollbar-hide flex shrink-0 gap-1.5 overflow-x-auto overscroll-x-contain px-3 py-2.5";

// PLACES 3.0 (MESITA-3662): one place per row, two equal squares, the photo
// left and the facts with Save · Share right. The row card (PlaceRowCard) and
// its loading silhouette (RowFallback) read these strings.

/** One column of rows; 12px sides, 10px between rows. */
export const ROW_LIST = "grid grid-cols-1 content-start gap-2.5 px-3 pt-1";

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
export const ROW_INFO =
  "bg-muted/60 flex aspect-square min-w-0 flex-col gap-1 rounded-r-2xl p-3";

// PLACES 4.0 (MESITA-3670): a vertical list of carousels, one per family,
// each card about two thirds of the width so about 1.5 show and the next
// one peeks. The card (PlaceRailCard) and its silhouette (RailFallback)
// read these strings.

/** One carousel: a sideways scroller that snaps card by card, 12px sides,
 *  10px between cards. */
export const RAIL_TRACK =
  "scrollbar-hide flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain scroll-px-3 px-3 pb-1";

/** A card: two thirds of the width, a soft fill, 16px corners. */
export const RAIL_CARD =
  "bg-muted/60 flex w-[66%] max-w-80 shrink-0 snap-start flex-col overflow-hidden rounded-2xl";

/** The card's photo: 4:3 across the top. */
export const RAIL_PHOTO = "bg-muted relative aspect-[4/3] overflow-hidden";

/** A carousel's title row: 16px semibold, 12px sides. */
export const RAIL_TITLE =
  "flex items-center justify-between gap-3 px-3 pt-4 pb-2";
