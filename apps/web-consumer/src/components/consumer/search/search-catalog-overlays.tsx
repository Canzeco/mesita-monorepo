import type { RefObject } from "react";

import type { MapScore, Place } from "@/lib/api/places";
import { Skeleton, Spinner } from "@/components/shared";
import type { Coords } from "@/lib/use-user-location";
import { useCardSaveShare } from "@/lib/use-card-save-share";
import { cn } from "@/lib/utils";

import { AddPlaceButton } from "./AddPlaceButton";
import { RailCard, RailCardSkeleton } from "./SearchRailCard";

/** How much narrower than the carousel one card page is. A page is the
 *  carousel less 96px (Pato, MESITA-3030: "make these boxes less wide";
 *  MESITA-3018's 64px, "its tooo wide, the other options must be kinda
 *  partially visible too"; MESITA-3008's 18px): a 6px gap between cards
 *  (px-[3px] each side), the first and last pages padded 48px, so the
 *  centred card sits 48px in and each neighbour peeks ~42px. The carousel spans the map's full width, floating over its
 *  foot. The scroll math in SearchClient reads `railPageWidth`. */
export const RAIL_PAGE_INSET_PX = 96;

/** One card page's width in px for a carousel `clientWidth` wide. */
export function railPageWidth(clientWidth: number): number {
  return clientWidth - RAIL_PAGE_INSET_PX;
}

const RAIL_PAGE =
  "flex w-[calc(100%-96px)] shrink-0 snap-center flex-col gap-1.5 px-[3px] first:ml-[48px] last:mr-[48px]";

/** Cards per carousel page: the rail is ONE card tall (Pato, MESITA-2885:
 *  "the carousel must be one item tall, not two, its a horizontal
 *  carousel"; reverses MESITA-2878's pair). SearchClient's page math reads
 *  the same number. */
export const RAIL_PAGE_SIZE = 1;

/** The catalog cut into pages of RAIL_PAGE_SIZE, in order. */
export function railPages<T>(items: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += RAIL_PAGE_SIZE) {
    pages.push(items.slice(i, i + RAIL_PAGE_SIZE));
  }
  return pages;
}

/** Where the carousel floats: over the map's foot, 8px up (MESITA-2670). */
export const RAIL_FLOAT_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-2 z-20";

/** Pages ahead of the places: the Add card is page 0 (MESITA-2886), so
 *  place page n sits at scroll page n + RAIL_LEAD_PAGES. SearchClient's
 *  scroll math reads the same number. */
export const RAIL_LEAD_PAGES = 1;

/** The rail's row: the carousel at the map's full width. Sideways: the
 *  pages (`RAIL_PAGE`) scroll left and right, one card each, the Add card
 *  first (MESITA-2886; MESITA-2885 pinned a narrow button beside it). */
const RAIL_ROW = "flex items-start pb-1";

/** The carousel: snap pages, sideways. */
const RAIL_SCROLLER =
  "scrollbar-hide flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto";

/** The first load's carousel (Pato, MESITA-2701: "the placeholders must be
 *  similar to the page you are loading, like the sizes"): the loaded row's
 *  own shape, the first page centred and
 *  the next one peeking at the right edge, each card RailCard's face (the
 *  score sits on the photo since MESITA-2877, so nothing waits above it).
 *  search/loading.tsx draws this same row, so the route's skeleton hands
 *  over to the first load without a move. */
export function CatalogRailSkeleton() {
  return (
    <div className={RAIL_ROW} aria-hidden>
      <div className={cn(RAIL_SCROLLER, "overflow-hidden")}>
        {[0, 1].map((page) => (
          <div key={page} className={RAIL_PAGE}>
            {Array.from({ length: RAIL_PAGE_SIZE }, (_, i) => (
              <RailCardSkeleton key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The measured clear window's edges (sight-frame.ts), as CSS SearchClient's
 *  map frame feeds (MESITA-3035); the fallbacks are the fixed 38% sight. */
export const SIGHT_TOP_CSS = "var(--sight-top, 0)";
export const SIGHT_BOTTOM_CSS = "var(--sight-bottom, 0.76)";
/** The sight's `top`: the clear window's middle. */
export const SIGHT_MID_TOP = `calc((${SIGHT_TOP_CSS} + ${SIGHT_BOTTOM_CSS}) * 50%)`;

/** The map before its tiles paint: a grey veil, the spinner ON THE CROSS
 *  (Pato, MESITA-2677: "the loading spin must be aligned with the cross"),
 *  at the sight, not the map's middle. SearchMap holds it until the tiles
 *  land; search/loading.tsx draws the same one (MESITA-2701). z-10: over
 *  the canvas, under the floating rail (z-20) and the header (z-30). */
export function MapVeil() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div
        className="absolute inset-x-0 flex -translate-y-1/2 justify-center"
        style={{ top: SIGHT_MID_TOP }}
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
function proximityInputs(
  score: Pick<MapScore, "distanceKm" | "distancePenalty">,
): string {
  const parts: string[] = [];
  if (typeof score.distanceKm === "number")
    parts.push(`${score.distanceKm.toFixed(2)} km`);
  if (typeof score.distancePenalty === "number")
    parts.push(`k ${score.distancePenalty}`);
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
      <dt>Card</dt>
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
 * THE PAID FACTOR IS A NUMBER, NOT A PILL (Pato, MESITA-2719): it reads
 * as `premier` on the numbers line, Premier's tier number or 1
 * (MESITA-2925; it was Selected's). Nothing on the card changes when the
 * score tag goes.
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
      className="bg-card/95 text-muted-foreground type-meta shadow-rest mb-1.5 rounded-xl px-3 py-1.5 font-mono leading-snug tabular-nums"
      data-rail-score-tag
    >
      <p className="text-foreground truncate font-semibold">
        {sources.length > 0 ? sources.join(" · ") : "no source"}
      </p>
      {/* Wraps rather than cuts: four numbers no longer fit one phone line. */}
      <p>
        {/* Premier reads as the third signal (MESITA-2718, MESITA-2925): the
            factor the final took, 1 for a place that is not Premier. */}
        {/* What Proximity read (Pato, MESITA-2830): the distance and the
            Distance penalty k, 1 ÷ (1 + k × km ÷ radius). */}
        proximity {fmtScore(score.proximity)}
        {proximityInputs(score)} · popularity {fmtScore(score.popularity)} ·
        premier{" "}
        {fmtScore(
          typeof score.selectedFactor === "number" ? score.selectedFactor : 1,
        )}{" "}
        · final {fmtScore(score.final)}
      </p>
    </div>
  );
}

/**
 * The same numbers ON THE CARD'S PHOTO (Pato, MESITA-2877: "remove the scores
 * from there for the moment and put them on top of the image but kinda
 * transparent"): Search's rail, and Home's tiles too since MESITA-3053. A translucent dark scrim at the photo's foot, small white mono,
 * one number a line so it fits the square (what Proximity read, km and k,
 * on a line of its own). It never takes a tap: the photo
 * is the card's open target. The sources line is gone here: since
 * MESITA-2872 every place carries both Mesita sources.
 */
export function RailScoreOverlay({ place }: { place: Pick<Place, "score"> }) {
  const score = place.score;
  if (!score) return null;
  return (
    <div
      className="type-meta pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1.5 font-mono leading-tight text-white/90 tabular-nums"
      data-rail-score-overlay
    >
      <p>prox {fmtScore(score.proximity)}</p>
      {typeof score.distanceKm === "number" ? (
        <p>
          {score.distanceKm.toFixed(2)} km
          {typeof score.distancePenalty === "number"
            ? ` · k ${score.distancePenalty}`
            : ""}
        </p>
      ) : null}
      <p>pop {fmtScore(score.popularity)}</p>
      <p>
        premier{" "}
        {fmtScore(
          typeof score.selectedFactor === "number" ? score.selectedFactor : 1,
        )}
      </p>
      <p className="font-semibold text-white">final {fmtScore(score.final)}</p>
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
  onAdd,
  setRailCardRef,
}: {
  places: Place[];
  catalogLoading?: boolean;
  selectedId: string | null;
  railScrollRef: RefObject<HTMLDivElement | null>;
  onRailScroll: () => void;
  onOpenPlace: (place: Place) => void;
  /** The Add button's tap: the bar's Add mode (MESITA-2885). */
  onAdd: () => void;
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
          // An empty area is the Add card alone, centred, and it says so:
          // nothing here is exactly when a guest adds one.
          <div className={RAIL_ROW} data-search-rail-empty>
            <div className={RAIL_SCROLLER}>
              <div className={RAIL_PAGE}>
                <AddPlaceButton onAdd={onAdd} empty />
              </div>
            </div>
          </div>
        ) : (
          <div className={RAIL_ROW}>
            <div
              ref={railScrollRef}
              onScroll={onRailScroll}
              className={RAIL_SCROLLER}
            >
              {/* Page 0: off-screen left while the rail rests on place #1. */}
              <div className={RAIL_PAGE}>
                <AddPlaceButton onAdd={onAdd} />
              </div>
              {railPages(places).map((page) => (
                <div
                  key={page[0].id}
                  ref={(el) => {
                    // Every card on the page scrolls to the page.
                    for (const place of page) setRailCardRef(place.id, el);
                  }}
                  className={cn(
                    RAIL_PAGE,
                    "transition-opacity duration-200",
                    // Dimmed, never locked (MESITA-2816): a tap during a
                    // reload still selects or opens. The Add card stays lit.
                    catalogLoading && "opacity-55",
                  )}
                >
                  {page.map((place) => (
                    <RailCard
                      key={place.id}
                      place={place}
                      photoOverlay={<RailScoreOverlay place={place} />}
                      selected={place.id === selectedId}
                      onOpen={() => onOpenPlace(place)}
                      saved={cards.isSaved(place)}
                      onSave={() => cards.toggle(place)}
                      onShare={() => cards.share(place)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
