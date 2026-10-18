import { Skeleton } from "@/components/shared";

// /search Suspense fallback. Mirror SearchClient's silhouette: the header
// (Search · Chat pills, Filters at the right, MESITA-2401), then the map
// with its top row (location disc · query pill) and the catalog rail.

export default function SearchLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="border-foreground/20 grid shrink-0 grid-cols-2 gap-2 border-b-2 px-2 pt-3 pb-2.5">
        <div className="grid grid-cols-2 gap-1">
          <Skeleton className="h-8 rounded-full" />
          <Skeleton className="h-8 rounded-full" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="relative min-h-0 w-full flex-1 overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />

        <div className="absolute inset-x-3 top-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="bg-card/95 shadow-elev h-11 w-11 shrink-0 rounded-full" />
            <Skeleton className="bg-card/95 shadow-elev h-11 min-w-0 flex-1 rounded-full" />
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
    </div>
  );
}
