import { Skeleton } from "@/components/shared";

// /search Suspense fallback. Mirror SearchHeader's silhouette: a white band
// with the row (location disc · query bar · Ask AI) and the chip row (All,
// then the families; no Filters disc, MESITA-2417), then the map and its
// catalog rail.

export default function SearchLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="border-border bg-card shrink-0 border-b">
        <div className="flex min-w-0 items-center gap-2 px-2 pt-2.5 pb-2">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <Skeleton className="h-11 min-w-0 flex-1 rounded-full" />
          <Skeleton className="h-11 w-24 shrink-0 rounded-full" />
        </div>
        <div className="flex gap-1.5 overflow-hidden px-2 pb-2.5" data-search-loading-chips>
          <Skeleton className="h-11 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-11 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
        </div>
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
