"use client";

// Places — Google Places, Mesita Selected, then one rail per guest family,
// each a sideways row of cards with its name running up the left edge.
//
// No chrome above the rails: no Filters bar (MESITA-2298) and, since
// MESITA-2362, no location bar either (Pato: "maybe remove it").
// `useUserLocation` asks the browser on mount, so the Google Places rail
// fills once location is granted and hides without it. The request sends
// no predicates, so a saved scope can never keep cutting this list. Search
// keeps its own Filters and its location disc.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Compass } from "lucide-react";
import { apiListCatalog, type CatalogRail, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics/track";
import { useUserLocation } from "@/lib/use-user-location";
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

// One card size, picked by geometry (Pato, MESITA-2360): two cards sit
// symmetric on the screen — the gap between them on the centre line — and
// the third card peeks in exactly as wide as the name column on the left.
// The column is 40px (its hairline inside, border-box) and every gap is 6px
// (MESITA-2358), so on a screen W wide a card is W/2 − 49px; in the
// scroller's content box (W − 52px) that is 50% − 23px. Holds at every
// width, which no fixed "2.x cards" can. It replaced the try-out size
// slider (MESITA-2340/2352/2356).
const cardWidth = "w-[calc(50%-23px)]";

export function CatalogRails() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
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
