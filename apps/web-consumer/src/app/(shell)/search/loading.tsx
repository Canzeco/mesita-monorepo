import { Skeleton } from "@/components/shared";

// /search Suspense fallback. Mirror SearchClient's silhouette: full-bleed
// map, query pill + Filters button, Category chips, catalog rail.
export default function SearchLoading() {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <Skeleton className="absolute inset-0 rounded-none" />

      <div className="absolute inset-x-3 top-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="bg-card/95 shadow-elev h-12 min-w-0 flex-1 rounded-full" />
          <Skeleton className="bg-card/95 h-12 w-12 shrink-0 rounded-full" />
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          <Skeleton className="bg-card/95 h-8 w-24 shrink-0 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-16 shrink-0 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-16 shrink-0 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-20 shrink-0 rounded-full" />
        </div>
      </div>

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
  );
}
