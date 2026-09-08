"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass } from "lucide-react";

import { apiRecommendDeck, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useUserLocation } from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { FEED_MOCK_PLACES } from "@/lib/mock/feed-places";
import { isPromoting } from "@/lib/promo-rates";
import { errMsg } from "@/lib/utils";
import { EmptyState } from "@/components/shared";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { trackEvent } from "@/lib/analytics/track";
import { GoSheet } from "@/components/consumer/place-detail/GoSheet";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { ScrollCard } from "./scroll-card";
import { ScrollHint } from "./scroll-hint";
import {
  readScrollPosition,
  writeScrollPosition,
} from "./scroll-position";

// SCROLL — Home's lead mode (MESITA-1697). One place per screen, vertical,
// no filters and no parameters. It replaces the card-stack deck; the CARD is
// unchanged (`PlaceSwipeCardFace`), only the way you get to the next one.
//
// TWO AXES, TWO MEANINGS. Vertical moves to the next place, horizontal pages
// that place's photos via the carousel already on the card face. In the stack
// the horizontal axis was spent on skip/save, so the photos had nowhere to go;
// freeing it is the thing that makes this shape earn itself, not the novelty
// of scrolling.
//
// SNAP IS MANDATORY, not proximity. At one card per viewport, a list that
// comes to rest showing two half-cards reads as a broken render rather than a
// feed — and mandatory snapping also gives the view analytics a real boundary
// to fire on.
//
// NO SKIP, DELIBERATELY. Scrolling past a card IS the skip, which is why this
// mode can drop two of the deck's five controls and still lose nothing. What
// it must NOT drop is Go: `useStartVisit` is the only path in the app that
// creates a ticket, so a Home whose actions are all bookmarks is a Home that
// cannot convert (Pato, MESITA-1697 gate, D2).
//
// `content-visibility: auto` IS NOT AN OPTIMISATION HERE, IT IS THE FEATURE.
// Each card mounts an ImageCarousel and a hidden sizing clone of its own
// fields; fifty of those at once is a reflow storm on a phone. Skipping layout
// and paint for off-screen rows is what makes the list scroll at all, and it
// is a CSS platform feature rather than a virtualization dependency.
// `contain-intrinsic-size` keeps the scrollbar honest while rows are skipped.
export function ScrollDeck({
  places,
  fetchError = null,
}: {
  places: Place[];
  fetchError?: string | null;
}) {
  const supabase = useBrowserSupabase();
  const center = useUserLocation();
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const { savedIds, hydrated, setSaved } = useSavedPlaces();

  // ONE PAIR OF SHEETS FOR THE WHOLE LIST, not one per card. GoSheet pulls the
  // guest's tickets when it mounts, so fifty of them would be fifty ticket
  // reads for a guest who is only scrolling. The card raises the intent and
  // this owns the surface — and, like the stack deck, Go and Reserve SWAP
  // rather than stack, because two sheets sliding up at the same z-tier read
  // as a rendering bug.
  const [goPlace, setGoPlace] = useState<Place | null>(null);
  const [reservePlace, setReservePlace] = useState<Place | null>(null);

  // THE SHARED DECK ARRIVES WITHOUT COORDINATES. HomeDeckBoundary calls
  // apiRecommendDeck with `{ limit }` only, so the EF scores it at
  // geo = { lat: null, lng: null } — Proximity contributes nothing and the
  // radius filter admits everything. The card-stack deck papered over that
  // with its own geo-keyed re-fetch, and deleting it without carrying this
  // across would have shipped a Home with location silently removed from the
  // blend, on the same day the copy stopped claiming signals it does not have.
  const [geoDeck, setGeoDeck] = useState<Place[] | null>(null);
  const geoKeyRef = useRef<string | null>(null);
  const geoKey = center ? `${center.lat.toFixed(3)},${center.lng.toFixed(3)}` : "";

  useEffect(() => {
    if (!center || geoKeyRef.current === geoKey) return;
    geoKeyRef.current = geoKey;
    let cancelled = false;
    apiRecommendDeck(supabase, { limit: 50, lat: center.lat, lng: center.lng })
      .then((result) => {
        if (cancelled) return;
        setGeoDeck(result.deck.map((p) => enrichPlaceOverview(p)));
      })
      .catch((err) => {
        // Keep the server deck. It is ranked without proximity rather than
        // wrong, and an empty screen would be the worse answer.
        console.warn(
          "[scroll] located deck fetch failed, keeping the shared deck:",
          errMsg(err, "located deck fetch failed"),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [center, geoKey, supabase]);

  // LISTED MESITA PLACES ONLY. This guard is the deck component's own half of
  // a Discovery quality floor that `swipe-mesita-listed.test.ts` pins across
  // the EF and the client — it is NOT redundant with HomeDeckBoundary's copy,
  // because the geo re-fetch above bypasses that boundary entirely.
  const rows = useMemo(() => {
    const source = geoDeck ?? places;
    const listed = source.filter(
      (place) => !place.googleOnly && !place.from_google,
    );
    return [...listed]
      .sort((a, b) => (isPromoting(a) ? 0 : 1) - (isPromoting(b) ? 0 : 1))
      .map((p) => withUserDistance(p, center));
  }, [geoDeck, places, center]);

  // ALL-REAL OR ALL-MOCK, never a mixture — the rule PlaceFeed established
  // when it faced the same empty catalog (MESITA-1621). A "scroll" of one real
  // place cannot perform the gesture it is named for, and three real cards
  // padded with invented ones would be indistinguishable on a full-bleed card.
  const usingMock = rows.length < 2;
  const deck = useMemo(
    () =>
      usingMock
        ? FEED_MOCK_PLACES.map((p) => withUserDistance(p, center))
        : rows,
    [usingMock, rows, center],
  );

  const toggleSave = (place: Place) => {
    const next = !savedIds.has(place.id);
    if (next) {
      upsertSavedPlacePreview(place);
      setSaved(place.id, true);
      trackEvent(supabase, "home_card_save", { mode: "scroll", place_id: place.id });
      // First save only. The filled, scaled heart is the receipt from then on;
      // a toast on every save would be noise on a surface built for volume.
      if (savedIds.size === 0) toast.success("Saved — find it in Favs");
    } else {
      setSaved(place.id, false);
    }
  };

  // Sibling modes share this layout, so Next unmounts the leaf on every tab
  // switch. Without this, Scroll → Feed → Scroll silently returns to the top;
  // the stack deck survived the same trip by storing which places were seen.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const saved = readScrollPosition();
    if (saved > 0) el.scrollTop = saved;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => writeScrollPosition(el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (deck.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No places yet"
        description="Tonight's places didn't come back. Pull the tab again in a moment."
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {usingMock && (
        // The mock must never pass for live data. Pinned OVER the first card
        // rather than stacked above the list: a strip above a full-bleed card
        // is a header, and this mode does not have one.
        <p className="bg-foreground/85 text-background pointer-events-none absolute inset-x-3 top-2 z-10 rounded-lg px-3 py-1.5 text-center text-xs leading-snug backdrop-blur-sm">
          {fetchError
            ? "Tonight's places didn't load — showing samples."
            : "Sample places while the catalog fills up."}
        </p>
      )}

      <ul
        ref={scrollerRef}
        aria-label="Places"
        className="scrollbar-hide flex min-h-0 flex-1 snap-y snap-mandatory flex-col gap-3 overflow-y-auto overscroll-y-contain px-3 pt-2 pb-3"
      >
        {deck.map((place, i) => (
          <ScrollCard
            key={place.id}
            place={place}
            priority={i === 0}
            saved={hydrated && savedIds.has(place.id)}
            onToggleSave={() => toggleSave(place)}
            onGo={() => {
              // Go is the conversion intent; `ticket_created` fires later from
              // useStartVisit and joins to this through the place.
              trackEvent(supabase, "home_card_open", {
                mode: "scroll",
                place_id: place.id,
                position: i,
              });
              setGoPlace(place);
            }}
            // The first card is the only one that teaches. Letting the next
            // card peek under it is how every vertical feed says "there is
            // more below" without an overlay — and at N=1 there is no second
            // card to peek, which is exactly why the mock fallback exists.
            peek={i === 0 && deck.length > 1}
          />
        ))}

        {/* The list needs a terminal snap point, not a route-level empty
            screen — scrolling past the last card into blank space is the
            failure the stack deck answered with ExhaustedDeck. */}
        <li className="flex snap-start snap-always shrink-0 items-center justify-center py-16">
          <div className="text-center">
            <p className="text-foreground font-display text-base font-semibold tracking-tight">
              That&apos;s everywhere for now
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              You&apos;ve reached the end of tonight&apos;s places.
            </p>
          </div>
        </li>
      </ul>

      <ScrollHint show={deck.length > 1} />

      {goPlace && (
        <GoSheet
          place={goPlace}
          open
          onClose={() => setGoPlace(null)}
          onReserve={() => {
            setReservePlace(goPlace);
            setGoPlace(null);
          }}
        />
      )}

      {reservePlace && (
        <ReservationSheet
          place={{ id: reservePlace.id, name: reservePlace.name }}
          open
          onClose={() => setReservePlace(null)}
        />
      )}
    </div>
  );
}
