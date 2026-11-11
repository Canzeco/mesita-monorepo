import { BrandHeader } from "@/components/consumer/ModeTabs";
import {
  DiscoverFallback,
  GridFallback,
  RowFallback,
  RailFallback,
} from "@/components/consumer/home/DiscoverFallback";
import { GRID_CHIPS } from "@/components/consumer/home/place-grid-classes";
import { Skeleton } from "@/components/shared";

// Home's loading frame: CatalogRails' bands, block for block — the white
// header, the white tab strip with its hairline, then the chip row over
// Places 3.0's rows (the default, MESITA-3662) or over the grid (`grid`,
// MESITA-3658), or, with `classic`, the old list: the grey family column a
// quarter wide beside the tile column. Drawn by every frame that can stand
// before Home lands (the discovery group, the shell, a full page load), so a
// tap on Home never shows a spinner first (MESITA-2840).
export function HomeLoadingFrame({
  view = "rows",
}: {
  view?: "rows" | "grid" | "classic" | "rails";
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
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 justify-center py-3">
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
      {view === "rails" ? (
        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
          <RailFallback />
        </div>
      ) : view === "classic" ? (
        <div className="flex min-h-0 flex-1">
          <div className="bg-muted w-1/4 shrink-0" />
          <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <DiscoverFallback />
          </div>
        </div>
      ) : (
        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={GRID_CHIPS}>
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-16 shrink-0 rounded-full" />
            ))}
          </div>
          {view === "grid" ? <GridFallback /> : <RowFallback />}
        </div>
      )}
    </div>
  );
}
