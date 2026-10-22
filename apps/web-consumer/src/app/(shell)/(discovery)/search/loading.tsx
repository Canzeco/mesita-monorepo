import { Skeleton } from "@/components/shared";
import { CHIP, HEADER_PILL } from "@/components/consumer/search/header-classes";
import {
  CatalogRailSkeleton,
  MapVeil,
  RAIL_FLOAT_CLASS,
} from "@/components/consumer/search/search-catalog-overlays";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { cn } from "@/lib/utils";

// /search Suspense fallback: SearchClient's frame, block for block (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). SearchHeader's one white band: the bar's row
// (the 36px locate disc · the query bar · the Ask AI pill) at 10px above
// and below, a hairline, the chip row (Top, then every family) at 10px
// above and below, a hairline under both. Then the map under MapVeil, the
// spinner on the cross, and the carousel floating over the map's foot
// (MESITA-2670): the same veil and the same first-load row the mounted
// page draws until its tiles and catalog land, so nothing moves on arrival.

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
      <div className="border-border bg-card shrink-0 border-b">
        <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-9 min-w-0 flex-1 rounded-full" />
          <ControlSkeleton token={HEADER_PILL} label="Ask AI" />
        </div>
        <div className="border-border flex items-center gap-2 overflow-hidden border-t px-3 py-2.5">
          <ControlSkeleton token={CHIP} label="Top" />
          {FILTERABLE_PLACE_FAMILIES.map((family) => (
            <ControlSkeleton
              key={family.key}
              token={CHIP}
              label={family.label}
            />
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MapVeil />
        <div className={RAIL_FLOAT_CLASS}>
          <CatalogRailSkeleton />
        </div>
      </div>
    </div>
  );
}
