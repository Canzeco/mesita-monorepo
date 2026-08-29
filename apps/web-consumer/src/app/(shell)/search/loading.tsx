import { Skeleton } from "@/components/shared";

// /search Suspense fallback. Mirror SearchClient's silhouette: full-bleed
// map, one row of query pill + filter chips, catalog rail at the bottom.
export default function SearchLoading() {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <Skeleton className="absolute inset-0 rounded-none" />

      <div className="absolute inset-x-3 top-3 flex items-center gap-2">
        <Skeleton className="bg-card/95 shadow-elev h-12 min-w-0 flex-[1.15] basis-0 rounded-full" />
        <div className="flex min-w-0 flex-1 basis-0 gap-1.5 overflow-hidden">
          <Skeleton className="bg-card/95 h-8 w-16 shrink-0 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-20 shrink-0 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-14 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3">
        <div className="mb-2 flex justify-center">
          <Skeleton className="bg-card/95 h-6 w-24 rounded-full" />
        </div>
        <div className="flex snap-x snap-mandatory overflow-hidden">
          <div className="w-4/5 shrink-0 snap-center px-3 first:ml-[10%] last:mr-[10%]">
            <Skeleton className="bg-card/95 h-[88px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
