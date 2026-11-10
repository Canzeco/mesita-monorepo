// The Places grid's boxes (MESITA-3658), one source for the card
// (PlaceGridCard) and its loading silhouette (DiscoverFallback), so the
// places land where the silhouettes stood. A plain module: a server loading
// frame reads these strings too.

/** Two columns, three from 640px; 12px sides, 10px between columns, 16px
 *  between rows. */
export const GRID_LIST =
  "grid grid-cols-2 content-start gap-x-2.5 gap-y-4 px-3 pt-1 sm:grid-cols-3";

/** The square photo, 12px corners. */
export const GRID_PHOTO =
  "bg-muted relative aspect-square overflow-hidden rounded-xl";

/** The two lines under the photo: the name's 20px line, the facts' 16px. */
export const GRID_TEXT = "flex flex-col pt-1.5";
export const GRID_NAME_LINE = "h-5";
export const GRID_FACT_LINE = "h-4";

/** The family chip row over the grid: one scrolling line, 12px sides. */
export const GRID_CHIPS =
  "scrollbar-hide flex shrink-0 gap-1.5 overflow-x-auto overscroll-x-contain px-3 py-2.5";
