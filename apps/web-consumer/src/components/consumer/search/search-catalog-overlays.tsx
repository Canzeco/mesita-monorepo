import type { RefObject } from "react";
import { ChevronUp, MapPin, Search, X } from "lucide-react";

import type { Place } from "@/lib/api/places";

import { RailCard } from "./SearchRailCard";

export function SearchRailOverlay({
  idle,
  places,
  catalogCount,
  railCollapsed,
  railIndex,
  selectedId,
  railScrollRef,
  onShowRail,
  onHideRail,
  onClearFilters,
  onRailScroll,
  onSelectPlace,
  onOpenPlace,
  setRailCardRef,
}: {
  idle: boolean;
  places: Place[];
  catalogCount: number;
  railCollapsed: boolean;
  railIndex: number;
  selectedId: string | null;
  railScrollRef: RefObject<HTMLDivElement | null>;
  onShowRail: () => void;
  onHideRail: () => void;
  onClearFilters: () => void;
  onRailScroll: () => void;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  setRailCardRef: (placeId: string, el: HTMLButtonElement | null) => void;
}) {
  if (!idle) return null;

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
            <div className="mb-2 flex justify-center">
              <span className="border-border bg-card/95 text-muted-foreground flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-[11px] font-semibold tabular-nums shadow-sm backdrop-blur">
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
        catalogCount > 0 && (
          <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur">
            <p className="text-muted-foreground text-xs">
              No places match these filters.
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="text-primary text-xs font-semibold"
            >
              Clear filters
            </button>
          </div>
        )
      )}
    </div>
  );
}

export function EmptySearchPrompt() {
  return (
    // Focused but empty -> a solid prompt panel over the TOP ~70% only, so the
    // live map stays visible in the strip below (the search moment still
    // reads as "browse the map"). Sits at z-20 below the z-30 floating
    // search bar (which the user types into).
    <div className="bg-background border-border absolute inset-x-0 top-0 z-20 flex h-[70%] flex-col items-center justify-center rounded-b-3xl border-b px-8 text-center shadow-sm">
      {/* decision: Lucide line Search in a tinted circle -- not the emoji, which
          Apple renders as a heavy 3D lupa that clashes with the rest of the
          consumer icon language. */}
      <span
        className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Search className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="mt-4 text-lg font-semibold">Where to today?</p>
      <p className="text-muted-foreground mt-1.5 max-w-[260px] text-sm">
        Find the perfect place by name or category.
      </p>
    </div>
  );
}
