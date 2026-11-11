import { Skeleton } from "@/components/shared";
import {
  CARD_ACTIONS_ROW,
  CARD_BUTTON_BOX,
} from "@/components/consumer/place-card";
import {
  TILE_ACTIONS,
  TILE_BAND,
  TILE_FRAME,
  TILE_PHOTO,
  TILE_TEXT,
} from "./catalog-tile-classes";
import {
  GRID_FACT_LINE,
  GRID_LIST,
  GRID_NAME_LINE,
  GRID_PHOTO,
  GRID_TEXT,
  ROW_INFO,
  ROW_LIST,
  ROW_PAIR,
  ROW_PHOTO,
  RAIL_CARD,
  RAIL_PHOTO,
  RAIL_TITLE,
  RAIL_TRACK,
} from "./place-grid-classes";

// HOME › PLACES WHILE ITS POOL LOADS (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): the tile
// column CatalogRails draws, block for block, so nothing moves when the
// places land. CatalogRails is its one caller: while the browser answers
// for the location and while the pool is in flight.

/** One tile per row (MESITA-2367), 6px of room above, left and right
 *  and between tiles — one space size (Pato, MESITA-2370). The list and its
 *  skeleton read this one string, so their gaps cannot drift. */
export const PLACES_LIST =
  "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";

/** CatalogTile's silhouette, from its own boxes (catalog-tile-classes.ts):
 *  the frame, the photo, the white band with its
 *  rows (the 16px name, the two 14px rows), Save · Share as two 32px blocks
 *  where CardActions sits. Most places have no coupon, so it draws none. */
function CatalogTileSkeleton() {
  return (
    <li className={TILE_FRAME}>
      <div className={TILE_PHOTO}>
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className={TILE_BAND}>
        <div className={TILE_TEXT}>
          <div className="flex h-5 items-center">
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-3/5" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>
      <div className={TILE_ACTIONS}>
        <div className={CARD_ACTIONS_ROW}>
          <Skeleton className={CARD_BUTTON_BOX} />
          <Skeleton className={CARD_BUTTON_BOX} />
        </div>
      </div>
    </li>
  );
}

/** Three tiles: more than the pane shows, since each tile is about as tall as the
 *  column is wide. Locating and loading draw the same three, so the hand-off
 *  between them never jumps. */
const TILES = 3;

export function DiscoverFallback() {
  return (
    <div className="pb-6" aria-busy>
      <ul aria-hidden className={PLACES_LIST}>
        {Array.from({ length: TILES }, (_, i) => (
          <CatalogTileSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

/** PlaceGridCard's silhouette, from its own boxes (place-grid-classes.ts):
 *  the square photo, the name's line, the facts' line. */
export function PlaceGridSkeleton() {
  return (
    <li className="min-w-0">
      <div className={GRID_PHOTO}>
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className={GRID_TEXT}>
        <div className={`flex items-center ${GRID_NAME_LINE}`}>
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <div className={`flex items-center ${GRID_FACT_LINE}`}>
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </li>
  );
}

/** The grid while its pool loads (MESITA-3658): six silhouettes, about a
 *  screen of them, in the grid's own gaps. */
export function GridFallback() {
  return (
    <div className="pb-6" aria-busy>
      <ul aria-hidden className={GRID_LIST}>
        {Array.from({ length: 6 }, (_, i) => (
          <PlaceGridSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

/** PlaceRowCard's silhouette (MESITA-3662): the photo square, and the info
 *  square with its name, two fact lines and the Save · Share row at its
 *  bottom. */
function PlaceRowSkeleton() {
  return (
    <li className={ROW_PAIR}>
      <div className={ROW_PHOTO}>
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className={ROW_INFO}>
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className={`mt-auto ${CARD_ACTIONS_ROW}`}>
          <Skeleton className={CARD_BUTTON_BOX} />
          <Skeleton className={CARD_BUTTON_BOX} />
        </div>
      </div>
    </li>
  );
}

/** Places 3.0 while its pool loads: four rows, about a screen of them. */
export function RowFallback() {
  return (
    <div className="pb-6" aria-busy>
      <ul aria-hidden className={ROW_LIST}>
        {Array.from({ length: 4 }, (_, i) => (
          <PlaceRowSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

/** PlaceRailCard's silhouette (MESITA-3670): the 4:3 photo, the name, two
 *  fact lines and the Save · Share row. */
function PlaceRailSkeleton() {
  return (
    <li className={RAIL_CARD}>
      <div className={RAIL_PHOTO}>
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <div className={CARD_ACTIONS_ROW}>
          <Skeleton className={CARD_BUTTON_BOX} />
          <Skeleton className={CARD_BUTTON_BOX} />
        </div>
      </div>
    </li>
  );
}

/** One carousel while it loads: its title (when known) and two cards. */
export function RailSkeleton({ title }: { title?: string }) {
  return (
    <section aria-busy>
      <div className={RAIL_TITLE}>
        {title ? (
          <h2 className="text-base font-semibold">{title}</h2>
        ) : (
          <Skeleton className="h-5 w-28" />
        )}
      </div>
      <ul aria-hidden className={RAIL_TRACK}>
        <PlaceRailSkeleton />
        <PlaceRailSkeleton />
      </ul>
    </section>
  );
}

/** Places 4.0 while the location settles: two carousels. */
export function RailFallback() {
  return (
    <div className="pb-6" aria-busy>
      <RailSkeleton />
      <RailSkeleton />
    </div>
  );
}
