import { Skeleton } from "@/components/shared";

// /search Suspense fallback. Mirror SearchHeader's silhouette (MESITA-2433):
// the band, then the row (a disc · the query bar · a disc; the test counts
// the two disc markers), then the chip row (All, then the families) in the
// SAME white band (MESITA-2469), then the map with nothing on it, then the
// full-width white band under it (MESITA-2506, MESITA-2509): the metadata
// rows on the left, the carousel's card on the right.

export default function SearchLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="border-border bg-card shrink-0 border-b">
        <div className="flex min-w-0 items-center gap-2 px-3 pt-2 pb-2">
          <div className="shrink-0" data-skeleton-disc>
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <Skeleton className="h-9 min-w-0 flex-1 rounded-full" />
          <div className="shrink-0" data-skeleton-disc>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
        <div
          className="flex gap-2 overflow-hidden px-3 pb-2"
          data-search-loading-chips
        >
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        </div>
      </div>
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="border-border bg-card flex h-[10.5rem] shrink-0 items-stretch border-t">
        <div className="border-border flex w-1/2 shrink-0 flex-col gap-1.5 border-r px-2.5 py-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
        <div className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-hidden py-2.5 pb-3.5">
          <div className="w-[88%] shrink-0 snap-center px-1.5 first:ml-[6%] last:mr-[6%]">
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
