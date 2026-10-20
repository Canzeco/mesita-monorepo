import { Skeleton } from "@/components/shared";

// /search Suspense fallback. Mirror SearchHeader's silhouette (MESITA-2433):
// the band, then the row (a disc · the query bar · a disc; the test counts
// the two disc markers), then the chip row's grey band (Nearby, Popular,
// then the families; MESITA-2462), then the map and its catalog rail.

export default function SearchLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="border-border bg-card/95 shrink-0 border-b backdrop-blur">
        <div className="flex min-w-0 items-center gap-2 px-3 pt-2 pb-2">
          <div className="shrink-0" data-skeleton-disc>
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <Skeleton className="h-9 min-w-0 flex-1 rounded-full" />
          <div className="shrink-0" data-skeleton-disc>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <div
        className="border-border bg-muted flex shrink-0 gap-2 overflow-hidden border-b px-3 py-2"
        data-search-loading-chips
      >
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
      </div>
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />

        <div className="absolute inset-x-3 bottom-3">
          <div className="mb-2 flex justify-center">
            <Skeleton className="bg-card/95 h-6 w-24 rounded-full" />
          </div>
          <div className="flex snap-x snap-mandatory overflow-hidden">
            <div className="w-4/5 shrink-0 snap-center px-3 first:ml-[10%] last:mr-[10%]">
              <Skeleton className="bg-card/95 h-24 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
