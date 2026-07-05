import { Skeleton, Spinner } from "@/components/shared";

// /explore/map Suspense fallback. The page server-fetches the catalog
// before ConsumerDiscoverMap mounts — hold the map-region silhouette
// meanwhile: full-bleed muted wash with the counts pill / legend chrome
// floating on top, and the shared spinner as the centre beat (the border
// track recolored so it stays visible on the muted wash).
export default function ExploreMapLoading() {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <Skeleton className="absolute inset-0 rounded-none" />

      {/* Counts pill + legend silhouettes, matching the real map chrome. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <Skeleton className="bg-card/95 h-7 w-36 rounded-full" />
        <Skeleton className="bg-card/95 h-12 w-24 rounded-2xl" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner
          label="Loading map"
          className="border-border border-t-primary"
        />
      </div>
    </div>
  );
}
