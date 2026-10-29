import { Skeleton } from "@/components/shared";
import { CHIP } from "@/components/consumer/search/header-classes";
import {
  CatalogRailSkeleton,
  MapVeil,
  RAIL_FLOAT_CLASS,
} from "@/components/consumer/search/search-catalog-overlays";
import { cn } from "@/lib/utils";

// /search Suspense fallback: SearchClient's frame, block for block (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). The map under MapVeil with SearchHeader floating
// on its top edge, no band (MESITA-2996): the one 48px bar with the 48px locate
// disc beside it (MESITA-3006), then the 32px chip row (the Filters disc,
// Top, then families; MESITA-2882). Then the spinner on the cross, and the carousel floating
// over the map's foot (MESITA-2670): the same veil and the same first-load
// row (skeleton pages) the mounted page draws until its
// tiles and catalog land, so nothing moves on arrival.

/** A header control's grey block at the control's own size: its token
 *  classes around its real label and a 16px icon box, kept invisible, so
 *  the block is the loaded pill's or chip's width; only the block shows. */
function ControlSkeleton({ token, label }: { token: string; label: string }) {
  return (
    <div aria-hidden className={cn(token, "invisible relative")}>
      <Skeleton className="visible absolute -inset-px rounded-full" />
      <span className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

export default function SearchLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p role="status" className="sr-only">
        Loading Search
      </p>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MapVeil />
        <div className="absolute inset-x-0 top-0 z-30">
          <div className="flex items-center gap-2 px-3 pt-3">
            <Skeleton className="h-12 min-w-0 flex-1 rounded-full" />
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          </div>
          <div className="flex items-center gap-2 overflow-hidden pt-1 pl-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex items-center gap-2 py-2 pr-3">
              <ControlSkeleton token={CHIP} label="Top" />
              {["Coffee", "Breakfast", "Brunch", "Bakery"].map((label) => (
                <ControlSkeleton key={label} token={CHIP} label={label} />
              ))}
            </div>
          </div>
        </div>
        <div className={RAIL_FLOAT_CLASS}>
          <CatalogRailSkeleton />
        </div>
      </div>
    </div>
  );
}
