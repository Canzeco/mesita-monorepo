import { Skeleton } from "@/components/shared";

// /search Suspense fallback. The page server-fetches the public-places
// catalog before SearchClient can mount — mirror its silhouette meanwhile:
// the full-bleed map region with the floating split search bar and quick
// chip row on top. bg-card skeletons over the muted map wash keep the
// floating chrome reading as elevated, like the real bar.
export default function SearchLoading() {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      {/* Map region — fills the whole body band. */}
      <Skeleton className="absolute inset-0 rounded-none" />

      {/* Floating top overlay: split search bar + filter button + chips. */}
      <div className="absolute inset-x-3 top-3">
        <Skeleton className="bg-card/95 shadow-elev h-11 w-full rounded-2xl" />
        <div className="mt-2 flex items-center gap-2 pb-1">
          <Skeleton className="bg-card/95 h-11 w-11 shrink-0 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-24 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-20 rounded-full" />
          <Skeleton className="bg-card/95 h-8 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}
