import type { RefObject } from "react";
import { ChevronUp, MapPin, Search, SlidersHorizontal, X } from "lucide-react";

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
  idle,
  places,
  catalogCount,
  catalogLoading = false,
  overspan = false,
  truncated = null,
  railCollapsed,
  railIndex,
  selectedId,
  railScrollRef,
  onShowRail,
  onHideRail,
  onRailScroll,
  onSelectPlace,
  onOpenPlace,
  onResetFilters,
  filterCount = 0,
  onOpenFilters,
  setRailCardRef,
}: {
  idle: boolean;
  places: Place[];
  catalogCount: number;
  catalogLoading?: boolean;
  overspan?: boolean;
  truncated?: string | null;
  railCollapsed: boolean;
  railIndex: number;
  selectedId: string | null;
  railScrollRef: RefObject<HTMLDivElement | null>;
  onShowRail: () => void;
  onHideRail: () => void;
  onRailScroll: () => void;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  onResetFilters?: () => void;
  /** Applied-filter count for the badge. 0 renders the resting pill. */
  filterCount?: number;
  /** Omitted = no Filters pill at all, which is how Pay and any other
   *  non-map caller of this overlay keeps its bottom row clean. */
  onOpenFilters?: () => void;
  setRailCardRef: (placeId: string, el: HTMLElement | null) => void;
}) {
  if (!idle) return null;

  // FILTERS LIVE DOWN HERE (Pato, 2026-09-02), beside the count they change.
  //
  // It rode the top row until 2026-09-02 and kept escalating to be seen —
  // icon-only, then a label, then primary-filled — because it was competing
  // with the search bar for the one row this mode can spend on chrome. Then it
  // came off entirely, and the answer was "where are the filters???".
  //
  // Down here it is not competing with anything, and it sits next to the
  // number it edits: "2 / 16 places" and the control that decides the 16. It
  // cannot go directly UNDER the bar either — the results dropdown owns that
  // space and would cover it the moment anyone typed.
  //
  // It wears the COUNTER's chrome, not the old top-row button's: same
  // type-label, same border and blur, so the two read as one cluster rather
  // than a small pill next to a shouting one.
  const filtersPill = onOpenFilters ? (
    <button
      type="button"
      onClick={onOpenFilters}
      aria-label={
        filterCount > 0 ? `Filters, ${filterCount} applied` : "Filter places"
      }
      aria-haspopup="dialog"
      className={cn(
        "shadow-rest type-label flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold backdrop-blur transition active:scale-95",
        filterCount > 0
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card/95 text-muted-foreground hover:text-foreground",
      )}
    >
      <SlidersHorizontal className="h-3 w-3 shrink-0" strokeWidth={2.25} />
      Filters
      {filterCount > 0 && (
        <span className="bg-primary-foreground/25 ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 leading-none font-bold tabular-nums">
          {filterCount}
        </span>
      )}
    </button>
  ) : null;

  if (overspan) {
    return (
      <div className="absolute inset-x-0 bottom-3 z-20">
        <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max max-w-[calc(100%-1.5rem)] items-center rounded-2xl border px-4 py-3 backdrop-blur">
          <p className="text-muted-foreground text-xs">
            Zoom in to see this area
          </p>
        </div>
      </div>
    );
  }

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
            {filtersPill}
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
            {truncated && (
              <p className="text-muted-foreground mb-1 text-center text-xs">
                {truncated}
              </p>
            )}
            <div className="mb-2 flex items-center justify-center gap-1.5">
              {filtersPill}
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
        (catalogCount > 0 || !catalogLoading) && (
          <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max max-w-[calc(100%-1.5rem)] flex-col items-center gap-2 rounded-2xl border px-4 py-3 backdrop-blur">
            <p className="text-muted-foreground text-xs">
              {onResetFilters
                ? "No places match these filters"
                : "No places to show here yet."}
            </p>
            {/* Empty because the filters cut everything is the ONE state that
                most needs the filters reachable — Reset is the blunt way out,
                the pill is the way to fix one predicate and keep the rest. */}
            <div className="flex items-center gap-2">
              {filtersPill}
              {onResetFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-primary text-xs font-semibold"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

export function EmptySearchPrompt() {
  // Content-sized hint that hangs under the search bar. A fixed 70% sheet
  // here is the "tall empty panel" Design §D forbids — the map is the
  // Search tab's dominant visual and has to stay on screen.
  return (
    <div className="flex flex-col items-center px-6 py-5 text-center">
      <span
        className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Search className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="font-display mt-3 text-base font-semibold tracking-tight">
        Where to today?
      </p>
      <p className="text-muted-foreground mt-1 max-w-[240px] text-sm">
        Find a place by name or category.
      </p>
    </div>
  );
}
