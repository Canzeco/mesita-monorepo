import { BrandHeader } from "@/components/consumer/ModeTabs";
import {
  DiscoverFallback,
  RowFallback,
} from "@/components/consumer/home/DiscoverFallback";
import { GRID_CHIPS } from "@/components/consumer/home/place-grid-classes";
import { Skeleton } from "@/components/shared";

// Home's loading frame: CatalogRails' bands, block for block — the white
// header, the white tab strip with its hairline, the grey family column a
// quarter wide, then the tile column; with `rows`, Places 3.0's chip row
// over its rows (MESITA-3762). Drawn by every frame that can stand
// before Home lands (the discovery group, the shell, a full page load), so a
// tap on Home never shows a spinner first (MESITA-2840).
export function HomeLoadingFrame({
  view = "tiles",
}: {
  view?: "tiles" | "rows";
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy>
      <p role="status" className="sr-only">
        Loading Home
      </p>
      <BrandHeader>
        <Skeleton className="ml-auto h-8 w-36 rounded-full" />
      </BrandHeader>
      <div className="border-border bg-card flex shrink-0 border-b">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 justify-center py-3">
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
      {view === "rows" ? (
        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={GRID_CHIPS}>
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-16 shrink-0 rounded-full" />
            ))}
          </div>
          <RowFallback />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="bg-background w-1/4 shrink-0" />
          <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <DiscoverFallback />
          </div>
        </div>
      )}
    </div>
  );
}
