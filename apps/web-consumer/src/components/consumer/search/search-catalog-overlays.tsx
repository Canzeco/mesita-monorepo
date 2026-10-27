import type { RefObject } from "react";

import type { MapScore, Place } from "@/lib/api/places";
import { Skeleton, Spinner } from "@/components/shared";
import type { Coords } from "@/lib/use-user-location";
import { useCardSaveShare } from "@/lib/use-card-save-share";
import { cn } from "@/lib/utils";

import { RailCard, RailCardSkeleton } from "./SearchRailCard";
import { SIGHT_Y } from "./search-utils";

/** The share of the carousel's width one card page takes: 88% with 6% pads,
 *  so the active card centres and its neighbours peek. The carousel spans
 *  the map's full width, floating over its foot (MESITA-2670); before, it
 *  sat in a white band under the map, the band's right half (MESITA-2509),
 *  then its full width (MESITA-2613). The scroll math in SearchClient reads
 *  the same number. */
export const RAIL_PAGE_SHARE = 0.88;

/** Active card is 88% of the carousel; first/last pages pad 6% so the card
 *  centers and neighbors peek. px-1.5 is a bit of air between cards —
 *  inside the page, so the snap math stays 88% and the selected ring does
 *  not kiss the neighbor. */
const RAIL_PAGE =
  "w-[88%] shrink-0 snap-center px-1.5 first:ml-[6%] last:mr-[6%]";

/** Where the carousel floats: over the map's foot, 8px up (MESITA-2670). */
export const RAIL_FLOAT_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-2 z-20";

/** The ranking line that sits on a loaded card (RailScoreTag): two 10px
 *  lines in the same box, so the card does not jump up when the line
 *  arrives (MESITA-2750). The words are data; only the bars show. */
function RailScoreTagSkeleton() {
  return (
    <div
      aria-hidden
      className="bg-card/95 type-meta mb-1.5 rounded-xl px-3 py-1.5 font-mono leading-snug shadow-sm"
    >
      <div className="flex h-[1lh] items-center">
        <Skeleton className="h-2.5 w-28" />
      </div>
      <div className="flex h-[1lh] items-center">
        <Skeleton className="h-2.5 w-full" />
      </div>
    </div>
  );
}

/** The first load's carousel (Pato, MESITA-2701: "the placeholders must be
 *  similar to the page you are loading, like the sizes"): the loaded row's
 *  own pages, the first card centred and the next one peeking at the right
 *  edge, each card RailCard's face with the score line above it.
 *  search/loading.tsx draws this same row, so the route's skeleton hands
 *  over to the first load without a move. */
export function CatalogRailSkeleton() {
  return (
    <div
      className="scrollbar-hide flex snap-x snap-mandatory overflow-hidden pb-1"
      aria-hidden
    >
      <div className={RAIL_PAGE}>
        <RailScoreTagSkeleton />
        <RailCardSkeleton />
      </div>
      <div className={RAIL_PAGE}>
        <RailScoreTagSkeleton />
        <RailCardSkeleton />
      </div>
    </div>
  );
}

/** The map before its tiles paint: a grey veil, the spinner ON THE CROSS
 *  (Pato, MESITA-2677: "the loading spin must be aligned with the cross"),
 *  SIGHT_Y down, not the map's middle. SearchMap holds it until the tiles
 *  land; search/loading.tsx draws the same one (MESITA-2701). z-10: over
 *  the canvas, under the floating rail (z-20) and the header (z-30). */
export function MapVeil() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div
        className="absolute inset-x-0 flex -translate-y-1/2 justify-center"
        style={{ top: `${SIGHT_Y * 100}%` }}
      >
        <Spinner
          label="Loading map"
          className="border-border border-t-primary"
        />
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
};

/** A signal or score for the readout: two decimals, "n/a" when absent. */
function fmtScore(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "n/a";
}

/** " (0.42 km, k 2)": what Proximity read; empty from an older EF. */
function proximityInputs(score: Pick<MapScore, "distanceKm" | "distancePenalty">): string {
  const parts: string[] = [];
  if (typeof score.distanceKm === "number") parts.push(`${score.distanceKm.toFixed(2)} km`);
  if (typeof score.distancePenalty === "number") parts.push(`k ${score.distancePenalty}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

// MESITA-2497/2498: development-stage check of the map (Pato: "display the
// coordinates at the bottom"). The cross, the blue dot and the centre sent
// to list-places, as of the last catalog load; MESITA-2504 adds the circle
// the load gated on (the weights it scored with until MESITA-2722), and the selected card's
// proximity · popularity · score, live as the selection moves. It was the
// white band's top section over the carousel (Pato, MESITA-2613: "on top of
// the carrousel, not in x but in y"); the band and the readout went when the
// carousel moved over the map (MESITA-2670), so nothing draws it now.
// SearchClient still records each load's coordinates (setLoadCoords) for
// when it comes back. Remove when Pato says the map is verified.
export function SearchDebugCoords({
  cross,
  you,
  sent,
  radiusKm,
  selected,
}: LoadCoords & { selected?: Place | null }) {
  const fmt = (c: Coords | null) =>
    c ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : "no fix";
  const score = selected?.score;
  return (
    <dl className="text-muted-foreground type-meta grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 font-mono leading-snug whitespace-nowrap tabular-nums">
      <dt>Cross</dt>
      <dd className="text-foreground truncate">{fmt(cross)}</dd>
      <dt>You</dt>
      <dd className="text-foreground truncate">{fmt(you)}</dd>
      <dt>Loaded at</dt>
      <dd className="text-foreground truncate">{fmt(sent)}</dd>
      <dt>Radius</dt>
      <dd className="text-foreground truncate" data-debug-radius>
        {radiusKm == null ? "n/a" : `${radiusKm.toFixed(2)} km`}
      </dd>
      <dt>Selected</dt>
      <dd className="text-foreground truncate" data-debug-selected>
        {score
          ? `prox ${fmtScore(score.proximity)} · pop ${fmtScore(score.popularity)} = ${fmtScore(score.final)}`
          : "n/a"}
      </dd>
    </dl>
  );
}

/** The two Area sources as the tag names them (MESITA-2703 keys; Google
 *  Nearby's two retired in MESITA-2872). */
const SOURCE_LABELS: ReadonlyArray<[string, string]> = [
  ["mesitaPopular", "Mesita Popularity"],
  ["mesitaClosest", "Mesita Proximity"],
];

/**
 * FOR THE MOMENT (Pato, MESITA-2705: "on top of the carousel … display the
 * sources where that [place] appears … then the two signals proximity and
 * popularity and the final score"): a small tag over each card, which of the
 * sources found the place and its score, read from the server's
 * `score` (MESITA-2703). Remove when Pato says the ranking is verified.
 *
 * SELECTED IS A NUMBER, NOT A PILL (Pato, MESITA-2719: "the selected tag
 * must not exist, just expressed as text in the numeric data above"): the
 * red Selected pill (MESITA-2707) is gone; Selected reads only as the
 * `selected` factor on the numbers line. Nothing on the card changes when
 * the score tag goes.
 */
export function RailScoreTag({ place }: { place: Pick<Place, "score"> }) {
  const score = place.score;
  if (!score) return null;
  const found = new Set(score.foundBy ?? []);
  const sources = SOURCE_LABELS.filter(([key]) => found.has(key)).map(
    ([, label]) => label,
  );
  return (
    <div
      className="bg-card/95 text-muted-foreground type-meta mb-1.5 rounded-xl px-3 py-1.5 font-mono leading-snug tabular-nums shadow-rest"
      data-rail-score-tag
    >
      <p className="text-foreground truncate font-semibold">
        {sources.length > 0 ? sources.join(" · ") : "no source"}
      </p>
      {/* Wraps rather than cuts: four numbers no longer fit one phone line. */}
      <p>
        {/* Selected reads as the third signal (Pato, MESITA-2718): the factor
            the final took (MESITA-2717), 1 for a place that is not Selected. */}
        {/* What Proximity read (Pato, MESITA-2830): the distance and the
            Distance penalty k, 1 ÷ (1 + k × km ÷ radius). */}
        proximity {fmtScore(score.proximity)}
        {proximityInputs(score)} · popularity{" "}
        {fmtScore(score.popularity)} · selected{" "}
        {fmtScore(
          typeof score.selectedFactor === "number" ? score.selectedFactor : 1,
        )}{" "}
        · final {fmtScore(score.final)}
      </p>
    </div>
  );
}

export function SearchRailOverlay({
  places,
  catalogLoading = false,
  selectedId,
  railScrollRef,
  onRailScroll,
  onOpenPlace,
  setRailCardRef,
}: {
  places: Place[];
  catalogLoading?: boolean;
  selectedId: string | null;
  railScrollRef: RefObject<HTMLDivElement | null>;
  onRailScroll: () => void;
  onOpenPlace: (place: Place) => void;
  setRailCardRef: (placeId: string, el: HTMLElement | null) => void;
}) {
  const firstLoad = catalogLoading && places.length === 0;
  // Save and Share on a card, Home's own (MESITA-2668): a Google-only card
  // creates the place on the tap, then saves or shares it.
  const cards = useCardSaveShare();

  // THE CAROUSEL FLOATS OVER THE MAP'S FOOT (Pato, MESITA-2670: "the
  // carousel must be floating over the map"); the white band under the map
  // and its readout (MESITA-2506, MESITA-2613) are gone. The empty state and
  // the first-load skeleton sit where the cards do. The rail is always shown
  // (MESITA-2508). It floats, so a load never resizes the map: a band that
  // sized to its rows read as a move and reloaded again (MESITA-2510).
  return (
    <div
      className={RAIL_FLOAT_CLASS}
      aria-busy={catalogLoading}
      aria-live={firstLoad ? "polite" : undefined}
      data-search-rail-band
    >
      <div
        className="pointer-events-auto flex flex-col justify-center"
        data-search-rail-cards
      >
        {firstLoad ? (
          <CatalogRailSkeleton />
        ) : places.length === 0 ? (
          <p className="bg-card/95 text-muted-foreground mx-auto rounded-full px-3 py-1.5 text-center text-xs shadow-sm">
            No places to show here yet.
          </p>
        ) : (
          <div
            ref={railScrollRef}
            onScroll={onRailScroll}
            className={cn(
              "scrollbar-hide flex snap-x snap-mandatory overflow-x-auto pb-1 transition-opacity duration-200",
              // Dimmed, never locked (MESITA-2816): a tap during a reload
              // still selects or opens.
              catalogLoading && "opacity-55",
            )}
          >
            {places.map((place) => (
              <div
                key={place.id}
                ref={(el) => setRailCardRef(place.id, el)}
                className={RAIL_PAGE}
              >
                <RailScoreTag place={place} />
                <RailCard
                  place={place}
                  selected={place.id === selectedId}
                  onOpen={() => onOpenPlace(place)}
                  saved={cards.isSaved(place)}
                  onSave={() => cards.toggle(place)}
                  onShare={() => cards.share(place)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
