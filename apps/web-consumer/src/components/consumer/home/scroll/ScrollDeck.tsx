"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, SlidersHorizontal } from "lucide-react";

import { apiRecommendDeck, type Place } from "@/lib/api/places";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { withUserDistance } from "@/lib/place-distance";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { isPromoting } from "@/lib/promo-rates";
import { cn, errMsg } from "@/lib/utils";
import { EmptyState } from "@/components/shared";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { trackEvent } from "@/lib/analytics/track";
import { GoSheet } from "@/components/consumer/place-detail/GoSheet";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  applyDiscoveryFilters,
  countAppliedDiscoveryFilters,
  hasDiscoveryPredicates,
} from "@/lib/discovery-filters-engine";
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";
import {
  UNFILTERED_DECK_KEY,
  deckRequestKey,
  toDeckRequest,
} from "@/lib/discovery-filters-wire";
import { ScrollCard } from "./scroll-card";
import { ScrollHint } from "./scroll-hint";
import {
  readScrollPosition,
  writeScrollPosition,
} from "./scroll-position";

// SCROLL — Home's lead mode (MESITA-1697). One place per screen, vertical.
// Filters match the map (MESITA-1792): Super Category, Places scope, Google
// review floor, plus connect location. The CARD is unchanged
// (`PlaceSwipeCardFace`), only the way you get to the next one.
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
/** Cards in a full deck. Cycled from the real rows until the catalog can fill it. */
const DECK_SIZE = 50;

export function ScrollDeck({
  places,
  fetchError = null,
}: {
  places: Place[];
  fetchError?: string | null;
}) {
  const supabase = useBrowserSupabase();
  const center = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const { savedIds, hydrated, setSaved } = useSavedPlaces();
  const filters = useDiscoveryFilters();
  const appliedCount = countAppliedDiscoveryFilters(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const requestKeyRef = useRef<string | null>(null);
  const requestKey = deckRequestKey(filters, center);

  useEffect(() => {
    if (requestKeyRef.current === requestKey) return;
    requestKeyRef.current = requestKey;
    let cancelled = false;
    if (requestKey === UNFILTERED_DECK_KEY) {
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        setGeoDeck(null);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    const req = toDeckRequest(filters, center, 50);
    apiRecommendDeck(supabase, req)
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
  }, [center, filters, requestKey, supabase]);

  // LISTED MESITA PLACES ONLY. This guard is the deck component's own half of
  // a Discovery quality floor that `swipe-mesita-listed.test.ts` pins across
  // the EF and the client — it is NOT redundant with HomeDeckBoundary's copy,
  // because the geo re-fetch above bypasses that boundary entirely.
  const rows = useMemo(() => {
    const source = geoDeck ?? places;
    const listed = source.filter((place) => {
      if (place.googleOnly || place.from_google) {
        return filters.placesScope === "google";
      }
      return true;
    });
    const ranked = [...listed]
      .sort((a, b) => (isPromoting(a) ? 0 : 1) - (isPromoting(b) ? 0 : 1))
      .map((p) => withUserDistance(p, center));
    return applyDiscoveryFilters(ranked, filters);
  }, [geoDeck, places, center, filters]);

  // THE DECK IS ALWAYS 50, CYCLED FROM WHATEVER IS REAL (Pato, live: "the deck
  // must be 50 items. then it repeats. if n is one, fill the 50 items deck with
  // the same place. for the moment").
  //
  // NO MOCK DATA. This replaced a fallback that swapped in eight invented
  // places whenever the catalog held fewer than two — Pato killed it on sight
  // ("don't put shitty mock data"), and he is right that it was the wrong
  // trade: a feed of plausible-looking places that cannot be visited teaches
  // the reviewer nothing and quietly becomes the thing everyone demos.
  // Repeating the ONE real place is honest by construction — you can tap it,
  // save it, and start a visit at it.
  //
  // TEMPORARY, and the instruction said so. When the catalog holds 50+ this
  // slice is a plain `rows.slice(0, DECK_SIZE)` and the modulo goes away;
  // until then it is what makes the gesture reviewable at all.
  const deck = useMemo(() => {
    if (rows.length === 0) return [];
    return Array.from(
      { length: DECK_SIZE },
      (_, i) => rows[i % rows.length] as Place,
    );
  }, [rows]);

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

  const filtersSheet = (
    <LocalSheet
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      ariaLabel="Filters"
    >
      <DiscoveryFilters
        onClose={() => setFiltersOpen(false)}
        count={rows.length === 0 ? 0 : rows.length}
        hasLocation={center !== null}
        locating={locating}
        onLocate={locate}
      />
    </LocalSheet>
  );

  const filtersDisc = (
    <button
      type="button"
      onClick={() => setFiltersOpen(true)}
      aria-label={
        appliedCount > 0 ? `Filters, ${appliedCount} applied` : "Filter places"
      }
      aria-haspopup="dialog"
      aria-pressed={appliedCount > 0}
      className={cn(
        "shadow-elev absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[0.98]",
        appliedCount > 0
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card/95 text-foreground",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      {appliedCount > 0 && (
        <span className="bg-foreground text-background type-meta absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-bold tabular-nums">
          {appliedCount}
        </span>
      )}
    </button>
  );

  // TWO DIFFERENT FAILURES, TWO DIFFERENT SCREENS. A deck that came back empty
  // means the catalog is still filling; a deck that FAILED means we could not
  // ask. Telling a guest the catalog is empty when the request 502'd sends them
  // away from a screen that a retry would have fixed — and it is the exact
  // conflation the mock strip used to paper over.
  if (deck.length === 0) {
    if (fetchError) {
      return (
        <EmptyState
          icon={Compass}
          title="Couldn't load tonight's places"
          description="The request didn't come back. Pull the tab again in a moment."
        />
      );
    }
    if (hasDiscoveryPredicates(filters)) {
      return (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {filtersDisc}
          {filtersSheet}
          <EmptyState
            icon={SlidersHorizontal}
            title="No places match these filters"
            description="Nothing in tonight's catalog fits. Widen a filter and the cards come back."
            action={{ label: "Clear filters", onClick: resetDiscoveryFilters }}
          />
        </div>
      );
    }
    return (
      <EmptyState
        icon={Compass}
        title="No places yet"
        description="The catalog is still filling up. Check back soon."
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* ABSOLUTE, NOT `flex-1`, AND THAT IS THE WHOLE FIX. Each card asks for
          `height: 100%`, and a percentage only resolves against a parent with a
          DEFINITE height. As a flex child (`min-h-0 flex-1`) this list had none,
          so every card fell back to content height — and the card face paints
          its photo `absolute inset-0`, which contributes zero. The result was a
          feed of bare action rows with no images at all. `absolute inset-0`
          inside the relative parent gives a definite box, so 100% means the
          scrollport.

          NO `gap` EITHER: with full-height snap items a gap is a strip you can
          come to rest on, showing two half cards. The spacing lives inside the
          card instead. */}
      {filtersDisc}
      {filtersSheet}

      <ul
        ref={scrollerRef}
        aria-label="Places"
        className="scrollbar-hide absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
      >
        {deck.map((place, i) => (
          <ScrollCard
            // The same place can legitimately appear many times while the
            // catalog is small, so the id alone is not unique.
            key={`${place.id}-${i}`}
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
        <li className="flex snap-start snap-always shrink-0 items-center justify-center px-3 py-16">
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
