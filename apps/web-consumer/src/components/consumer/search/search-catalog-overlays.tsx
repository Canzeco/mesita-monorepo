import type { RefObject } from "react";
import { ChevronUp, MapPin, Search, X } from "lucide-react";

import type { Place } from "@/lib/api/places";

import { RailCard } from "./SearchRailCard";

export function SearchRailOverlay({
  idle,
  places,
  catalogCount,
  catalogLoading = false,
  overspan = false,
  truncated = null,
  filtersActive,
  railCollapsed,
  railIndex,
  selectedId,
  railScrollRef,
  onShowRail,
  onHideRail,
  onRailScroll,
  onSelectPlace,
  onOpenPlace,
  onOpenFilters,
  setRailCardRef,
}: {
  idle: boolean;
  places: Place[];
  catalogCount: number;
  catalogLoading?: boolean;
  overspan?: boolean;
  truncated?: string | null;
  filtersActive: boolean;
  railCollapsed: boolean;
  railIndex: number;
  selectedId: string | null;
  railScrollRef: RefObject<HTMLDivElement | null>;
  onShowRail: () => void;
  onHideRail: () => void;
  onRailScroll: () => void;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  onOpenFilters: () => void;
  setRailCardRef: (placeId: string, el: HTMLButtonElement | null) => void;
}) {
  if (!idle) return null;

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
      <div className="absolute inset-x-0 bottom-3 z-20">
        <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max max-w-[calc(100%-1.5rem)] items-center rounded-2xl border px-4 py-3 backdrop-blur">
          <p className="text-muted-foreground text-xs">
            Finding places around you…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-3 z-20">
      {places.length > 0 ? (
        railCollapsed ? (
          // Dismissed -> a single floating pill reopens the rail. Tapping
          // any pin reopens it too (handleSelectPlace).
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onShowRail}
              className="border-border bg-card/95 text-foreground shadow-elev flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tabular-nums backdrop-blur transition active:scale-95"
            >
              <ChevronUp className="text-primary h-4 w-4" />
              Show {places.length} {places.length === 1 ? "place" : "places"}
            </button>
          </div>
        ) : (
          <>
            {truncated && (
              <p className="text-muted-foreground mb-1 text-center text-xs">
                {truncated}
              </p>
            )}
            <div className="mb-2 flex justify-center">
              <span className="border-border bg-card/95 text-muted-foreground shadow-rest type-label flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 font-semibold tabular-nums backdrop-blur">
                <MapPin className="text-primary h-3 w-3" />
                {places.length > 1 ? (
                  <>
                    {Math.min(railIndex + 1, places.length)} / {places.length}
                  </>
                ) : (
                  places.length
                )}
                <span className="text-muted-foreground/70 font-normal">
                  {places.length === 1 ? "place" : "places"}
                </span>
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
              className="scrollbar-hide flex gap-2 overflow-x-auto px-3 pb-1"
            >
              {places.map((place) => (
                <RailCard
                  key={place.id}
                  place={place}
                  selected={place.id === selectedId}
                  onSelect={() => onSelectPlace(place)}
                  onOpen={() => onOpenPlace(place)}
                  cardRef={(el) => setRailCardRef(place.id, el)}
                />
              ))}
            </div>
          </>
        )
      ) : (
        (catalogCount > 0 || !catalogLoading) && (
          <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur">
            <p className="text-muted-foreground text-xs">
              {filtersActive
                ? "No places match these filters."
                : "No places to show here yet."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={onOpenFilters}
                className="text-primary type-label font-semibold"
              >
                Adjust
              </button>
            )}
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
