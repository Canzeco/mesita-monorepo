import { Skeleton } from "@/components/shared";

// HOME › PLACES WHILE ITS POOL LOADS (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): the tile
// column CatalogRails draws, block for block, so nothing moves when the
// places land. CatalogRails draws it while the browser answers for the
// location and while the pool is in flight; it had no caller since the
// pills went (MESITA-2168). No "use client", so a server file can import it.

/** One square tile per row (MESITA-2367), 6px of room above, left and right
 *  and between tiles — one space size (Pato, MESITA-2370). The list and its
 *  skeleton read this one string, so their gaps cannot drift. */
export const PLACES_LIST =
  "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";

/** CatalogTile's silhouette (CatalogTile.tsx): the square in its 1px grey
 *  hairline, rounded-2xl; the photo's top 60%; the white band's 40% with
 *  its three 20px rows (the 16px name, then the two 14px rows) centred over
 *  the 44px Save · Share leave; the two 32px buttons 12px from the sides
 *  and the foot. */
export function CatalogTileSkeleton() {
  return (
    <li className="border-foreground/35 relative isolate aspect-square min-w-0 overflow-hidden rounded-2xl border">
      <div className="absolute inset-x-0 top-0 h-[60%] overflow-hidden rounded-t-2xl">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="bg-paper absolute inset-x-0 bottom-0 h-[40%] overflow-hidden rounded-b-2xl">
        <div className="flex h-full flex-col justify-center gap-0.5 px-3 pb-11">
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
      <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </li>
  );
}

/** Three tiles: more than the pane shows, since each tile is as tall as the
 *  column is wide. Locating and loading draw the same three, so the hand-off
 *  between them never jumps. */
const TILES = 3;

export function DiscoverFallback({ locating = false }: { locating?: boolean }) {
  return (
    <div
      className="pb-6"
      aria-busy
      data-places-locating={locating ? "" : undefined}
    >
      <ul aria-hidden className={PLACES_LIST}>
        {Array.from({ length: TILES }, (_, i) => (
          <CatalogTileSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
