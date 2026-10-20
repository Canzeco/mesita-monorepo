import type { ReactNode, RefObject } from "react";
import { ChevronUp, MapPin, X } from "lucide-react";

import type { MapWeights, Place } from "@/lib/api/places";
import { Skeleton, Spinner } from "@/components/shared";
import type { Coords } from "@/lib/use-user-location";
import { cn } from "@/lib/utils";

import { RAIL_CARD_HEIGHT_CLASS, RailCard } from "./SearchRailCard";

/** Active card is 80% of the rail; first/last pages pad 10% so the card
 *  centers and neighbors peek. px-3 is a bit of air between cards —
 *  inside the page, so snap math stays 80% and the selected ring does
 *  not kiss the neighbor. */
const RAIL_PAGE =
  "w-4/5 shrink-0 snap-center px-3 first:ml-[10%] last:mr-[10%]";

/** The first load's pill, floating at the bottom of the map. */
function FindingNearbyPill() {
  return (
    <div className="flex justify-center">
      <span className="border-border bg-card/95 text-muted-foreground shadow-rest type-label flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2.5 font-semibold backdrop-blur">
        <Spinner size="sm" label="Finding nearby places" />
        Finding nearby
      </span>
    </div>
  );
}

/** The first load's card, in the band under the map. */
function CatalogRailSkeleton() {
  return (
    <>
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

export type LoadCoords = {
  cross: Coords | null;
  you: Coords | null;
  sent: Coords;
  /** The circle the server gated on, km (MESITA-2504). */
  radiusKm: number | null;
  /** The exponents it scored with (MESITA-2504). */
  weights: MapWeights | null;
};

/** A signal or score for the readout: two decimals, "n/a" when absent. */
function fmtScore(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "n/a";
}

// MESITA-2497/2498: development-stage check of the map, at the bottom of
// it above the rail (Pato: "display the coordinates at the bottom"). The
// cross, the blue dot and the centre sent to list-places, as of the last
// catalog load. MESITA-2504 adds, below and without removing anything, the
// circle the load gated on, the weights it scored with, and the selected
// card's proximity · popularity · score, live as the selection moves.
// Remove when Pato says the map is verified.
export function SearchDebugCoords({
  cross,
  you,
  sent,
  radiusKm,
  weights,
  selected,
}: LoadCoords & { selected?: Place | null }) {
  const fmt = (c: Coords | null) =>
    c ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : "no fix";
  const score = selected?.score;
  return (
    <div className="mb-2 flex justify-center">
      <dl className="border-border bg-card/90 text-muted-foreground shadow-rest type-meta grid grid-cols-[auto_auto] gap-x-2 rounded-lg border px-2.5 py-1 font-mono leading-tight tabular-nums backdrop-blur">
        <dt>Cross</dt>
        <dd className="text-foreground">{fmt(cross)}</dd>
        <dt>You</dt>
        <dd className="text-foreground">{fmt(you)}</dd>
        <dt>Loaded at</dt>
        <dd className="text-foreground">{fmt(sent)}</dd>
        <dt>Radius</dt>
        <dd className="text-foreground" data-debug-radius>
          {radiusKm == null ? "n/a" : `${radiusKm.toFixed(2)} km`}
        </dd>
        <dt>Weights</dt>
        <dd className="text-foreground" data-debug-weights>
          {weights
            ? `prox^${weights.proximity} · pop^${weights.popularity} · sel^${weights.selected}`
            : "n/a"}
        </dd>
        <dt>Selected</dt>
        <dd className="text-foreground" data-debug-selected>
          {score
            ? `prox ${fmtScore(score.proximity)} · pop ${fmtScore(score.popularity)} · sel ${fmtScore(score.selected)} = ${fmtScore(score.final)}`
            : "n/a"}
        </dd>
      </dl>
    </div>
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
  debug,
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
  /** Floats above the band, so it rides at the bottom of the map. */
  debug?: ReactNode;
}) {
  // Filters live on the top-right disc. Reset on this empty state was
  // the one-tap way out of a cut the guest made; the sheet's own Reset
  // is that now. An empty map is a fact about the catalog, the scope's cap, or
  // the guest's Popularity floor.

  const firstLoad = catalogLoading && places.length === 0;
  const showCards = firstLoad || (places.length > 0 && !railCollapsed);

  // What floats at the bottom of the map, just above the band: the debug
  // readout, then the loading pill, the counter, the reopen pill or the
  // empty state. The wrapper lets the map pan through; its pills take taps.
  let float: ReactNode;
  if (firstLoad) {
    float = <FindingNearbyPill />;
  } else if (places.length === 0) {
    float = (
      <div className="border-border bg-card/95 shadow-elev mx-auto flex w-max max-w-[calc(100%-1.5rem)] flex-col items-center gap-2 rounded-2xl border px-4 py-3 backdrop-blur">
        <p className="text-muted-foreground text-xs">
          No places to show here yet.
        </p>
      </div>
    );
  } else if (railCollapsed) {
    // Dismissed -> a single floating pill reopens the rail. Tapping any pin
    // reopens it too (handleSelectPlace).
    float = (
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
    );
  } else {
    float = (
      <div className="flex items-center justify-center gap-1.5">
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
          <span className="bg-border ml-0.5 h-3.5 w-px" aria-hidden="true" />
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
    );
  }

  // ONE SOLID WHITE BAND UNDER THE MAP for the cards, a hairline on top,
  // like the header band (Pato, MESITA-2506: "just cover the map, like its
  // okey if the places are in white box with a line … the same you did with
  // the searchbar and the categoeris but with the bottom bar"). The map ends
  // where the band starts; hiding the rail drops the band and the map grows.
  return (
    <div
      className="relative z-20 shrink-0"
      aria-busy={catalogLoading}
      aria-live={firstLoad ? "polite" : undefined}
      data-search-rail-band
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-full pb-3">
        <div className="pointer-events-auto flex flex-col">
          {debug}
          {float}
        </div>
      </div>
      {showCards ? (
        <div
          className="border-border bg-card border-t py-2.5"
          data-search-rail-cards
        >
          {firstLoad ? (
            <CatalogRailSkeleton />
          ) : (
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
          )}
        </div>
      ) : null}
    </div>
  );
}
