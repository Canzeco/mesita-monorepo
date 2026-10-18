"use client";

// Places — All, then one rail per guest family. A card is wide
// enough that about 2.5 fit, so the next one peeks and the row reads
// as a scroll. The gap above a row is the family name. An empty
// family is the name only. Favs keeps its own rounded tile.
//
// No Filters bar (MESITA-2298, Pato: "remove filters bar at the top, just
// leave something for the location"). The strip above the rails holds one
// control, Use my location; the request sends no predicates, so a saved
// scope can never keep cutting this list. Search keeps its own Filters.
// Location, when the browser has it, ranks proximity.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Compass, Navigation } from "lucide-react";
import { apiListCatalog, type CatalogRail, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics/track";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { onPlaceCreated } from "@/lib/place-created-event";
import { useOpenGooglePlace } from "@/lib/use-open-google-place";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { CatalogTile } from "./CatalogTile";
import { cn, errMsg } from "@/lib/utils";
import { placesFeed } from "@/lib/catalog-feed";
import { useStoredString } from "@/lib/local-store";
import { summarizeCatalog } from "@/lib/catalog-summary";

// TEMPORARY (Pato, MESITA-2340): a try-out switch for how many cards fit
// across the screen — 1.5, 1.75 (MESITA-2352), 2 or 2.5 (today's size). Literal class strings so
// Tailwind keeps them. Remove the switch once a size is picked.
const CARD_SIZES = ["1.5", "1.75", "2", "2.5"] as const;
type CardSize = (typeof CARD_SIZES)[number];
const CARD_WIDTH: Record<CardSize, string> = {
  "1.5": "w-[calc((100%-1rem)/1.5)]",
  "1.75": "w-[calc((100%-1rem)/1.75)]",
  "2": "w-[calc((100%-1rem)/2)]",
  "2.5": "w-[calc((100%-1rem)/2.5)]",
};
const CARD_SIZE_KEY = "mesita:feed-card-size";

function readCardSize(value: string): CardSize {
  return (CARD_SIZES as readonly string[]).includes(value)
    ? (value as CardSize)
    : "2.5";
}

export function CatalogRails() {
  const [storedSize, setCardSize] = useStoredString(CARD_SIZE_KEY, "2.5");
  const cardSize = readCardSize(storedSize);
  const cardWidth = CARD_WIDTH[cardSize];
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const { savedIds, setSaved } = useSavedPlaces();
  const openGooglePlace = useOpenGooglePlace();
  const [rails, setRails] = useState<CatalogRail[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const requestKey =
    coords === null ? "" : `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
  // The running load's background reload: the rails on screen stay until
  // the new ones land, and an error never replaces a good feed.
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    // The newest request wins; an older response is dropped.
    let seq = 0;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setRails(null);
      setFetchError(null);
    });
    const fetchRails = async (mode: "fresh" | "keep") => {
      const mine = ++seq;
      try {
        const next = await apiListCatalog(supabase, coords);
        if (cancelled || mine !== seq) return;
        setRails(next);
        setFetchError(null);
      } catch (err) {
        if (cancelled || mine !== seq || mode === "keep") return;
        setFetchError(errMsg(err, "Couldn't load the catalog"));
        setRails([]);
      }
    };
    reload.current = () => void fetchRails("keep");
    void fetchRails("fresh");
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      reload.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, requestKey]);

  // A Google-only card the guest opened is a Mesita place once the create
  // lands (PendingPlaceScreen says so). This Feed sits under the place
  // modal and nothing else refetches it: reload behind the modal and the
  // card comes back with its photo and its link, never the emoji stub
  // (MESITA-2307).
  useEffect(() => onPlaceCreated(() => reload.current()), []);

  const summary = useMemo(() => summarizeCatalog(rails ?? []), [rails]);
  const shownRails = useMemo(() => placesFeed(rails ?? []), [rails]);

  const locationStrip = (
    <div className="border-border bg-background/90 flex shrink-0 items-center gap-2 border-b px-4 py-2.5 backdrop-blur-xl">
      <button
        type="button"
        onClick={locate}
        disabled={coords !== null || locating}
        aria-label={
          coords !== null
            ? "Using your location"
            : locating
              ? "Locating"
              : "Use my location"
        }
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition",
          coords !== null
            ? "border-border bg-card text-muted-foreground"
            : "shadow-elev border-border bg-card/95 text-foreground backdrop-blur-xl active:scale-[0.98] disabled:opacity-60",
        )}
      >
        <Navigation className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="truncate">
          {coords !== null
            ? "Near you"
            : locating
              ? "Locating…"
              : "Use my location"}
        </span>
      </button>
      <div
        role="group"
        aria-label="Card size"
        className="border-border bg-card flex h-11 shrink-0 items-center gap-0.5 rounded-full border p-1"
      >
        {CARD_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setCardSize(size)}
            aria-pressed={cardSize === size}
            className={cn(
              "type-label h-full rounded-full px-2.5 font-semibold tabular-nums transition",
              cardSize === size
                ? "bg-foreground text-paper"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {size}×
          </button>
        ))}
      </div>
    </div>
  );

  const toggleSave = (place: Place, saved: boolean) => {
    if (saved) {
      setSaved(place.id, false);
      return;
    }
    upsertSavedPlacePreview(place);
    setSaved(place.id, true);
    trackEvent(supabase, "home_card_save", {
      mode: "places",
      place_id: place.id,
    });
  };

  const shell = (body: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      {locationStrip}
      {body}
    </div>
  );

  if (fetchError) {
    return shell(
      <EmptyState
        icon={Compass}
        title="Couldn't load the catalog"
        description="Tonight's places didn't come back. Pull the tab again in a moment."
        action={{ label: "Try again", href: CONSUMER_ROUTES.discoverDefault }}
      />,
    );
  }

  if (rails === null) {
    return shell(
      <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain pt-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex items-stretch">
            <div className="bg-muted/60 border-border flex w-10 shrink-0 justify-center border-r py-6">
              <Skeleton className="w-4 rounded-none" />
            </div>
            <div className="ml-3 flex min-w-0 flex-1 gap-1.5 overflow-hidden">
              {Array.from({ length: 3 }, (_, j) => (
                <Skeleton
                  key={j}
                  className={cn(
                    "border-border aspect-square shrink-0 rounded-lg border",
                    cardWidth,
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>,
    );
  }

  if (rails.length === 0) {
    return shell(
      <EmptyState
        icon={Compass}
        title="No places yet"
        description="The catalog is still filling up. Check back soon."
      />,
    );
  }

  // Three bands by POSITION (Pato, MESITA-2308): the first rail on the
  // deepest tint, the second lighter, every rail after it on the card
  // surface, a hairline between bands — a super subtle division that
  // survives the rails' renaming (MESITA-2302). The "N places" line sits on
  // band A's tint. Semantic tokens only.
  // The rail's name runs up the left edge of its cards, read bottom to top
  // (Pato's sketch, MESITA-2350): a narrow column the height of the row,
  // the name truncated to it, then the sideways card scroller. The column
  // wears its own tint and a hairline, with room before the cards
  // (MESITA-2351), so name and cards read as two parts. The row's vertical
  // padding lives on the card scroller, never around the rail, so the
  // tinted column runs edge to edge between the hairlines (MESITA-2354).
  const renderRail = (rail: CatalogRail) => (
    <section
      key={rail.key}
      aria-labelledby={`${rail.key}-heading`}
      className="flex items-stretch"
    >
      <div
        className="bg-muted/60 border-border relative w-10 shrink-0 border-r"
        data-rail-name
      >
        <h2
          id={`${rail.key}-heading`}
          className="font-display text-foreground absolute inset-0 flex flex-col items-center justify-center gap-1.5 overflow-hidden text-sm font-semibold tracking-tight"
        >
          {/* The emoji sits upright on top of the name, never rotated
              (Pato, MESITA-2354). */}
          {rail.emoji && rail.emoji !== "·" ? (
            <span className="shrink-0" aria-hidden data-rail-emoji>
              {rail.emoji}
            </span>
          ) : null}
          <span className="min-h-0 rotate-180 truncate [writing-mode:vertical-rl]">
            {rail.label}
          </span>
        </h2>
      </div>
      {rail.places.length > 0 ? (
        <ul
          role="list"
          aria-label={rail.label}
          className="scrollbar-hide ml-3 flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain py-3"
        >
          {rail.places.map((place) => {
            const located = withUserDistance(place, coords);
            const saved = savedIds.has(place.id);
            return (
              <CatalogTile
                key={place.id}
                place={located}
                saved={saved}
                onToggle={() => toggleSave(place, saved)}
                onOpenGoogle={() => openGooglePlace(place)}
                className={cn(cardWidth, "shrink-0")}
              />
            );
          })}
        </ul>
      ) : null}
    </section>
  );
  const [firstRail, secondRail, ...restRails] = shownRails;

  return shell(
    <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
      <div className="bg-muted/50" data-band="a">
        <p className="type-body text-muted-foreground px-3 py-2.5 tabular-nums">
          {summary.total} {summary.total === 1 ? "place" : "places"}
          {summary.openNow > 0 ? ` · ${summary.openNow} open now` : ""}
        </p>
        {firstRail ? renderRail(firstRail) : null}
      </div>
      {secondRail ? (
        <div className="bg-muted/25 border-border border-t" data-band="b">
          {renderRail(secondRail)}
        </div>
      ) : null}
      {restRails.length > 0 ? (
        // Every family rail has its own hairline too (Pato, MESITA-2353).
        <div
          className="bg-card border-border divide-border flex flex-col divide-y border-t"
          data-band="c"
        >
          {restRails.map((rail) => (
            <div key={rail.key}>
              {renderRail(rail)}
            </div>
          ))}
        </div>
      ) : null}
    </div>,
  );
}
