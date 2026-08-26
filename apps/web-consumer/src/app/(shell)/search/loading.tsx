import { Skeleton } from "@/components/shared";

// /search Suspense fallback. Mirror SearchClient's silhouette: full-bleed
// map, floating pill search bar (filters sit inside the pill), catalog rail
// at the bottom. No chip row — those left with the old filter strip.
export default function SearchLoading() {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <Skeleton className="absolute inset-0 rounded-none" />

      <div className="absolute inset-x-3 top-3">
        <Skeleton className="bg-card/95 shadow-elev h-12 w-full rounded-full" />
      </div>

      <div className="absolute inset-x-3 bottom-3">
        <div className="mb-2 flex justify-center">
          <Skeleton className="bg-card/95 h-6 w-24 rounded-full" />
        </div>
        <div className="flex snap-x snap-mandatory overflow-hidden">
          <div className="w-full shrink-0 snap-start">
            <Skeleton className="bg-card/95 h-[88px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
