import type { RefObject } from "react";
import { ChevronUp, MapPin, X } from "lucide-react";

import type { Place } from "@/lib/api/places";
import { Skeleton, Spinner } from "@/components/shared";
import { cn } from "@/lib/utils";

import { RAIL_CARD_HEIGHT_CLASS, RailCard } from "./SearchRailCard";

/** Active card is 80% of the rail; first/last pages pad 10% so the card
 *  centers and neighbors peek. px-3 is a bit of air between cards —
 *  inside the page, so snap math stays 80% and the selected ring does
 *  not kiss the neighbor. */
const RAIL_PAGE =
  "w-4/5 shrink-0 snap-center px-3 first:ml-[10%] last:mr-[10%]";

function CatalogRailSkeleton() {
  return (
    <>
      <div className="mb-2 flex justify-center">
        <span className="border-border bg-card/95 text-muted-foreground shadow-rest type-label flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2.5 font-semibold backdrop-blur">
          <Spinner size="sm" label="Finding nearby places" />
          Finding nearby
        </span>
      </div>
      <div
        className="scrollbar-hide flex snap-x snap-mandatory overflow-hidden pb-1"
        aria-hidden
      >
        <div className={RAIL_PAGE}>
          <div
            className={cn(
              "border-border bg-card/95 flex w-full items-stretch overflow-hidden rounded-2xl border",
              RAIL_CARD_HEIGHT_CLASS,
            )}
          >
            <Skeleton className="aspect-square h-full w-auto shrink-0 rounded-none" />
            <div className="grid min-w-0 flex-1 grid-rows-[1.25rem_repeat(3,1rem)] content-center gap-1 py-2 pr-2 pl-2.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SearchRailOverlay({
  places,
  catalogLoading = false,
  railCollapsed,
  railIndex,
  selectedId,
  railScrollRef,
  onShowRail,
  onHideRail,
  onRailScroll,
  onSelectPlace,
  onOpenPlace,
  setRailCardRef,
}: {
  places: Place[];
  catalogLoading?: boolean;
  railCollapsed: boolean;
  railIndex: number;
  selectedId: string | null;
  railScrollRef: RefObject<HTMLDivElement | null>;
  onShowRail: () => void;
  onHideRail: () => void;
  onRailScroll: () => void;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  setRailCardRef: (placeId: string, el: HTMLElement | null) => void;
}) {
  // Filters live on the top-right disc. Reset on this empty state was
  // the one-tap way out of a cut the guest made; the sheet's own Reset
  // is that now. An empty map is a fact about the catalog, the scope's cap, or
  // the guest's Popularity floor.

  if (catalogLoading && places.length === 0) {
    return (
      <div
        className="absolute inset-x-0 bottom-3 z-20"
        aria-busy="true"
        aria-live="polite"
      >
        <CatalogRailSkeleton />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-x-0 bottom-3 z-20"
      aria-busy={catalogLoading}
    >
      {places.length > 0 ? (
        railCollapsed ? (
          // Dismissed -> a single floating pill reopens the rail. Tapping
          // any pin reopens it too (handleSelectPlace).
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={onShowRail}
              className="border-border bg-card/95 text-foreground shadow-elev flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tabular-nums backdrop-blur transition active:scale-95"
            >
              {catalogLoading ? (
                <Spinner size="sm" label="Updating nearby places" />
              ) : (
                <ChevronUp className="text-primary h-4 w-4" />
              )}
              {catalogLoading
                ? "Updating nearby"
                : `Show ${places.length} ${places.length === 1 ? "place" : "places"}`}
            </button>
          </div>
        ) : (
          <>
            {/* The counter and its "Updating nearby" spinner sit a clear
                step above the card, not on its edge (Pato, MESITA-2465:
                "move the loading icon a bit to the more top"). */}
            <div className="mb-4 flex items-center justify-center gap-1.5">
              <span className="border-border bg-card/95 text-muted-foreground shadow-rest type-label flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 font-semibold tabular-nums backdrop-blur">
                {catalogLoading ? (
                  <Spinner size="sm" label="Updating nearby places" />
                ) : (
                  <MapPin className="text-primary h-3 w-3" />
                )}
                {catalogLoading ? (
                  <span>Updating nearby</span>
                ) : places.length > 1 ? (
                  <>
                    {Math.min(railIndex + 1, places.length)} / {places.length}
                  </>
                ) : (
                  places.length
                )}
                {!catalogLoading && (
                  <span className="text-muted-foreground/70 font-normal">
                    {places.length === 1 ? "place" : "places"}
                  </span>
                )}
                <span
                  className="bg-border ml-0.5 h-3.5 w-px"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={onHideRail}
                  aria-label="Hide places"
                  className="text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded-full transition active:scale-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div
              ref={railScrollRef}
              onScroll={onRailScroll}
              className={cn(
                "scrollbar-hide flex snap-x snap-mandatory overflow-x-auto pb-1 transition-opacity duration-200",
                catalogLoading && "pointer-events-none opacity-55",
              )}
            >
              {places.map((place) => (
                <div
                  key={place.id}
                  ref={(el) => setRailCardRef(place.id, el)}
                  className={RAIL_PAGE}
                >
                  <RailCard
                    place={place}
                    selected={place.id === selectedId}
                    onSelect={() => onSelectPlace(place)}
                    onOpen={() => onOpenPlace(place)}
                  />
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max max-w-[calc(100%-1.5rem)] flex-col items-center gap-2 rounded-2xl border px-4 py-3 backdrop-blur">
          <p className="text-muted-foreground text-xs">
            No places to show here yet.
          </p>
        </div>
      )}
    </div>
  );
}
