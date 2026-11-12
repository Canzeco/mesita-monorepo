import { Skeleton } from "@/components/shared";
import {
  CARD_ACTIONS_ROW,
  CARD_BUTTON_BOX,
} from "@/components/consumer/place-card";
import { ROW_INFO, ROW_LIST, ROW_PAIR, ROW_PHOTO } from "./place-grid-classes";

// HOME › PLACES WHILE ITS POOL LOADS (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): the rows
// CatalogRails draws, block for block, so nothing moves when the places
// land. Places 1.0's tile silhouette left with CatalogTile (MESITA-3794).

/** PlaceRowCard's silhouette (MESITA-3662): the photo square, and the info
 *  square with its name, three fact lines and the Save · Share row at its
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
