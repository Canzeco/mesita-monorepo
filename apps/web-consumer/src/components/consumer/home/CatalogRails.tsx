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

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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

// TEMPORARY (Pato, MESITA-2340): a try-out control for how many cards fit
// across the screen. A continuous slider since MESITA-2356 (it was four
// stops, MESITA-2352): 1.25 to 3 cards, default 2.5. The width rides one CSS
// variable, `--cards`, set on the rails' root, so cards and skeletons follow
// as it moves. Remove the slider once a size is picked.
const CARDS_MIN = 1.25;
const CARDS_MAX = 3;
const CARDS_STEP = 0.05;
const CARDS_DEFAULT = 2.5;
const CARD_SIZE_KEY = "mesita:feed-card-size";
const cardWidth = "w-[calc((100%-1rem)/var(--cards))]";

export function readCardsPerScreen(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return CARDS_DEFAULT;
  return Math.min(CARDS_MAX, Math.max(CARDS_MIN, n));
}

export function CatalogRails() {
  const [storedSize, setCardSize] = useStoredString(
    CARD_SIZE_KEY,
    String(CARDS_DEFAULT),
  );
  const cardsPerScreen = readCardsPerScreen(storedSize);
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
      <label className="border-border bg-card flex h-11 w-[42%] shrink-0 items-center gap-2 rounded-full border px-3">
        <span className="sr-only">Cards per screen</span>
        <input
          type="range"
          min={CARDS_MIN}
          max={CARDS_MAX}
          step={CARDS_STEP}
          value={cardsPerScreen}
          onChange={(e) => setCardSize(e.target.value)}
          className="accent-foreground h-11 min-w-0 flex-1 cursor-pointer"
          data-card-size-slider
        />
        <span className="type-label text-foreground w-10 shrink-0 text-right font-semibold tabular-nums">
          {cardsPerScreen.toFixed(2).replace(/0$/, "")}×
        </span>
      </label>
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
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ "--cards": cardsPerScreen } as CSSProperties}
    >
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
      <div className="bg-card scrollbar-hide divide-border flex min-h-0 flex-1 flex-col divide-y overflow-y-auto overscroll-y-contain">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex items-stretch">
            <div className="border-border flex w-10 shrink-0 justify-center border-r py-6">
              <Skeleton className="w-4 rounded-none" />
            </div>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden p-1.5">
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

  // Three bands by POSITION (MESITA-2308), now all on the one card
  // surface (Pato, MESITA-2355: "use same background color"): only the
  // hairlines divide — one above every rail, one right of each name. The
  // band wrappers stay so a tint is one class away. No places count
  // (MESITA-2354). Semantic tokens only.
  //
  // The rail's name runs up the left edge of its cards, read bottom to top
  // (Pato's sketch, MESITA-2350): a narrow column the height of the row,
  // the name truncated to it, then the sideways card scroller. A hairline
  // on the column's right (MESITA-2351) splits name from cards. ONE gap,
  // 6px, everywhere in the grid (Pato, MESITA-2358): between cards, card to
  // the rail lines above and below, card to the name line, and after the
  // last card — the scroller's `p-1.5` and `gap-1.5`. The padding lives on
  // the scroller, never around the rail, so the name line runs edge to edge
  // between the rail lines (MESITA-2354).
  const renderRail = (rail: CatalogRail) => (
    <section
      key={rail.key}
      aria-labelledby={`${rail.key}-heading`}
      className="flex items-stretch"
    >
      <div
        className="border-border relative w-10 shrink-0 border-r"
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
          className="scrollbar-hide flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain p-1.5"
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
    <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-6">
      <div data-band="a">
        {firstRail ? renderRail(firstRail) : null}
      </div>
      {secondRail ? (
        <div className="border-border border-t" data-band="b">
          {renderRail(secondRail)}
        </div>
      ) : null}
      {restRails.length > 0 ? (
        // Every family rail has its own hairline too (Pato, MESITA-2353).
        <div
          className="border-border divide-border flex flex-col divide-y border-t border-b"
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
