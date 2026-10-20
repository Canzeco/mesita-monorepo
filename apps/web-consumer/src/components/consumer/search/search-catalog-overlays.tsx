import type { ReactNode, RefObject } from "react";
import { MapPin } from "lucide-react";

import type { MapWeights, Place } from "@/lib/api/places";
import { Skeleton, Spinner } from "@/components/shared";
import type { Coords } from "@/lib/use-user-location";
import { cn } from "@/lib/utils";

import { RAIL_CARD_HEIGHT_CLASS, RailCard } from "./SearchRailCard";

/** The share of the carousel column one card page takes (MESITA-2509: the
 *  carousel is the band's right column now, so a page is 88% with 6% pads
 *  instead of 80/10/10 — the card keeps room for its text). The scroll math
 *  in SearchClient reads the same number. */
export const RAIL_PAGE_SHARE = 0.88;

/** Active card is 88% of the column; first/last pages pad 6% so the card
 *  centers and neighbors peek. px-1.5 is a bit of air between cards —
 *  inside the page, so the snap math stays 88% and the selected ring does
 *  not kiss the neighbor. */
const RAIL_PAGE =
  "w-[88%] shrink-0 snap-center px-1.5 first:ml-[6%] last:mr-[6%]";

/** The first load's card, in the carousel column. */
function CatalogRailSkeleton() {
  return (
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

// MESITA-2497/2498: development-stage check of the map (Pato: "display the
// coordinates at the bottom"). The cross, the blue dot and the centre sent
// to list-places, as of the last catalog load; MESITA-2504 adds the circle
// the load gated on, the weights it scored with, and the selected card's
// proximity · popularity · score, live as the selection moves. Since
// MESITA-2509 it is the band's LEFT column — plain small rows, no card, off
// the map. Remove when Pato says the map is verified.
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
    <dl className="text-muted-foreground type-meta grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 font-mono leading-snug tabular-nums">
      <dt>Cross</dt>
      <dd className="text-foreground break-words">{fmt(cross)}</dd>
      <dt>You</dt>
      <dd className="text-foreground break-words">{fmt(you)}</dd>
      <dt>Loaded at</dt>
      <dd className="text-foreground break-words">{fmt(sent)}</dd>
      <dt>Radius</dt>
      <dd className="text-foreground" data-debug-radius>
        {radiusKm == null ? "n/a" : `${radiusKm.toFixed(2)} km`}
      </dd>
      <dt>Weights</dt>
      <dd className="text-foreground break-words" data-debug-weights>
        {weights
          ? `prox^${weights.proximity} · pop^${weights.popularity} · sel^${weights.selected}`
          : "n/a"}
      </dd>
      <dt>Selected</dt>
      <dd className="text-foreground break-words" data-debug-selected>
        {score
          ? `prox ${fmtScore(score.proximity)} · pop ${fmtScore(score.popularity)} · sel ${fmtScore(score.selected)} = ${fmtScore(score.final)}`
          : "n/a"}
      </dd>
    </dl>
  );
}

export function SearchRailOverlay({
  places,
  catalogLoading = false,
  railIndex,
  selectedId,
  railScrollRef,
  onRailScroll,
  onSelectPlace,
  onOpenPlace,
  setRailCardRef,
  meta,
}: {
  places: Place[];
  catalogLoading?: boolean;
  railIndex: number;
  selectedId: string | null;
  railScrollRef: RefObject<HTMLDivElement | null>;
  onRailScroll: () => void;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  setRailCardRef: (placeId: string, el: HTMLElement | null) => void;
  /** The left column's readout, under the places count. */
  meta?: ReactNode;
}) {
  const firstLoad = catalogLoading && places.length === 0;

  // ONE FULL-WIDTH WHITE BAND UNDER THE MAP, a hairline on top, in two
  // columns (Pato, MESITA-2509: "bottom box white using 100% width … left
  // side for the meatadata … right sie for the carosuel and then leave the
  // fucking map visible"). Nothing floats over the map: the places count
  // heads the metadata, the empty state and the first-load skeleton sit in
  // the carousel's column. The rail is always shown (MESITA-2508).
  return (
    <div
      className="border-border bg-card relative z-20 flex shrink-0 items-stretch border-t"
      aria-busy={catalogLoading}
      aria-live={firstLoad ? "polite" : undefined}
      data-search-rail-band
    >
      <div
        className="border-border flex w-[42%] min-w-0 shrink-0 flex-col gap-1 border-r px-2.5 py-2"
        data-search-rail-meta
      >
        <p className="text-muted-foreground type-label flex items-center gap-1 font-semibold tabular-nums">
          {catalogLoading ? (
            <Spinner
              size="sm"
              label={
                firstLoad ? "Finding nearby places" : "Updating nearby places"
              }
            />
          ) : (
            <MapPin className="text-primary h-3 w-3 shrink-0" />
          )}
          {firstLoad ? (
            <span>Finding nearby</span>
          ) : catalogLoading ? (
            <span>Updating nearby</span>
          ) : places.length > 1 ? (
            <span>
              {Math.min(railIndex + 1, places.length)} / {places.length}{" "}
              <span className="text-muted-foreground/70 font-normal">
                places
              </span>
            </span>
          ) : (
            <span>
              {places.length}{" "}
              <span className="text-muted-foreground/70 font-normal">
                {places.length === 1 ? "place" : "places"}
              </span>
            </span>
          )}
        </p>
        {meta}
      </div>
      <div
        className="flex min-w-0 flex-1 flex-col justify-center py-2.5"
        data-search-rail-cards
      >
        {firstLoad ? (
          <CatalogRailSkeleton />
        ) : places.length === 0 ? (
          <p className="text-muted-foreground px-3 text-center text-xs">
            No places to show here yet.
          </p>
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
    </div>
  );
}
