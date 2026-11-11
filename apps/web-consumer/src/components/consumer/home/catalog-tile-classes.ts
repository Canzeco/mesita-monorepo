// THE HOME TILE'S BOXES, ONE SOURCE (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): CatalogTile
// and its loading silhouette (CatalogTileSkeleton, DiscoverFallback.tsx)
// read these strings, so the loading tile cannot drift from the loaded one.
// Layout only: each caller adds its own fill (the photo's grey, the ink).

/** The tile takes the height of its photo and its text (Pato, MESITA-3233:
 *  "return to 60% image and 40% text or whatever"; square from MESITA-2652 until
 *  the coupon needed a row under the buttons). rounded-2xl, edged by a shadow,
 *  not a line (Pato, MESITA-2838: "I don't like the borders of the items here in
 *  home"). The shadow is shadow-tile, only BELOW the tile and dark (Pato,
 *  MESITA-3065, MESITA-3068, MESITA-3074): its negative spread keeps it off the
 *  sides, its drop puts it underneath. */
export const TILE_FRAME =
  "relative isolate min-w-0 overflow-hidden rounded-2xl shadow-tile";

/** The photo: 4:3, four wide and three tall, as every Home photo (Pato,
 *  MESITA-3672: "each image must be 4:3"); it was three fifths of the width.
 *  It carries the radius itself, as the band does: a child layer can escape
 *  the parent's rounded clip (MESITA-2429). */
export const TILE_PHOTO = "relative aspect-[4/3] overflow-hidden rounded-t-2xl";

/** The plain white band under the photo (MESITA-2658: no reflection). */
export const TILE_BAND = "bg-paper overflow-hidden rounded-b-2xl";

/** The band's three 20px rows, 2px apart, 12px from the photo and the sides.
 *  pb-14 is the 32px row, its 12px foot and 12px over the buttons (Pato,
 *  MESITA-2645: equal margins). */
export const TILE_TEXT = "relative flex flex-col gap-0.5 px-3 pt-3 pb-14";

/** The text's foot on a tile with the voucher line: pb-24 adds the 32px line
 *  and its 8px gap (MESITA-3241, back for vouchers with MESITA-3312). */
export const TILE_TEXT_WITH_VOUCHERS = "pb-24";

/** Save · Share, 12px from the tile's sides AND its foot (MESITA-2668: "its
 *  not the same vertical margin as horizontal margin"). The coupon that sat
 *  under them left with the discount product (MESITA-3299); the voucher line
 *  took its place (MESITA-3312). */
export const TILE_ACTIONS = "absolute inset-x-3 bottom-3";

/** Save · Share, then the voucher line under them, 8px apart (MESITA-3233,
 *  MESITA-3312). */
export const TILE_FOOT = "flex flex-col gap-2";
