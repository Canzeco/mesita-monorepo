import { Skeleton } from "@/components/shared";
import {
  CARD_ACTIONS_ROW,
  CARD_BUTTON_BOX,
} from "@/components/consumer/place-card";
import { cn } from "@/lib/utils";
import {
  TILE_ACTIONS,
  TILE_BAND,
  TILE_FRAME,
  TILE_PHOTO,
  TILE_TEXT,
} from "./catalog-tile-classes";

// HOME › PLACES WHILE ITS POOL LOADS (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): the tile
// column CatalogRails draws, block for block, so nothing moves when the
// places land. CatalogRails is its one caller: while the browser answers
// for the location and while the pool is in flight.

/** One square tile per row (MESITA-2367), 6px of room above, left and right
 *  and between tiles — one space size (Pato, MESITA-2370). The list and its
 *  skeleton read this one string, so their gaps cannot drift. */
export const PLACES_LIST =
  "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";

/** CatalogTile's silhouette, from its own boxes (catalog-tile-classes.ts):
 *  the hairlined square, the photo's top 60%, the white band's 40% with its
 *  three 20px rows (the 16px name, then the two 14px rows), and Save ·
 *  Share as two 32px blocks where CardActions sits. */
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
      <div className={cn(CARD_ACTIONS_ROW, TILE_ACTIONS)}>
        <Skeleton className={CARD_BUTTON_BOX} />
        <Skeleton className={CARD_BUTTON_BOX} />
      </div>
    </li>
  );
}

/** Three tiles: more than the pane shows, since each tile is as tall as the
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
