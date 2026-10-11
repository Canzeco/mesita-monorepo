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
import {
  SCROLL_USES_MOCK,
  isMockPlace,
  scrollMockPlaces,
} from "@/lib/mock/scroll-places";
import { placeHref } from "@/lib/place-route";
import { sharePlace } from "@/lib/share-place";
import { cn, errMsg } from "@/lib/utils";
import { EmptyState } from "@/components/shared";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { trackEvent } from "@/lib/analytics/track";
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
import { ScrollCard, scrollCardActions } from "./scroll-card";
import { ScrollHint } from "./scroll-hint";
import { readScrollPosition, writeScrollPosition } from "./scroll-position";

// SCROLL — Home's lead mode (MESITA-1697), a TikTok feed since MESITA-2105.
// One place per screen, vertical. Filters match the map (MESITA-1792):
// Family, Places scope, Google review floor, plus connect location.
//
// TWO AXES, TWO MEANINGS. Vertical moves to the next place, horizontal pages
// that place's photos (the carousel's native scroller). Double-tap saves; a
// single tap does nothing (design 4A). The card itself is ScrollCard: the
// photo edge to edge, an action column on the right, the name bottom-left.
//
// SNAP IS MANDATORY, not proximity. At one card per viewport, a list that
// comes to rest showing two half-cards reads as a broken render rather than a
// feed — and mandatory snapping also gives the view analytics a real boundary
// to fire on.
//
// NO SKIP, DELIBERATELY. Scrolling past a card IS the skip. What it must NOT
// drop is a conversion: a Home whose actions are all bookmarks cannot convert.
// Since 2026-10-10 that is Reserve — the MVP's First Stage is reservations,
// and Go's visit and order doors are Second Stage.
//
// ONLY THE CARD ON SCREEN AND ITS NEIGHBOURS LOAD PHOTOS EAGERLY (eng review
// R3). All fifty cards are in the DOM; with the carousel in native mode each
// would otherwise start three photo downloads at mount — about 4-7 MB before
// the first swipe. `active` comes from the scroll listener this file already
// keeps for position restore.
/** Cards in a full deck. Cycled from the real rows until the catalog can fill it. */
const DECK_SIZE = 50;
const EMPTY_IDS: ReadonlySet<string> = new Set();

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

  // ONE SHEET FOR THE WHOLE LIST, not one per card: the card raises the intent
  // and this owns the surface. Reserve opens the reservation sheet directly —
  // Go (Visit · Order · Reserve) left the card with the MVP's First Stage,
  // where reservations are the conversion (Pato, 2026-10-10: "Profile, Save,
  // Share, Reserve").
  const [reservePlace, setReservePlace] = useState<Place | null>(null);

  // A mock card's heart lives here and nowhere else (design 3A): writing a
  // `mock-` id into Favs would leave a ghost place on the Favs tab after the
  // mock is gone.
  const [mockSavedIds, setMockSavedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const setMockSaved = (id: string, saved: boolean) =>
    setMockSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  // The card on screen, from the scroll listener below (eng review R3).
  const [active, setActive] = useState(0);

  // THE SHARED DECK ARRIVES WITHOUT COORDINATES. HomeDeckBoundary calls
  // apiRecommendDeck with `{ limit }` only, so the EF scores it at
  // geo = { lat: null, lng: null } — Proximity contributes nothing and the
  // radius filter admits everything. The card-stack deck papered over that
  // with its own geo-keyed re-fetch, and deleting it without carrying this
  // across would have shipped a Home with location silently removed from the
  // blend, on the same day the copy stopped claiming signals it does not have.
  const [geoDeck, setGeoDeck] = useState<Place[] | null>(null);
  // The key whose answer has LANDED, not the one last asked. Recording the key
  // at request time meant an effect re-run with the same key (a fresh
  // `center` object at the same rounded point, or StrictMode's double run)
  // cancelled the in-flight fetch and then skipped asking again, so the
  // located deck silently never arrived.
  const settledKeyRef = useRef<string | null>(null);
  const requestKey = deckRequestKey(filters, center);

  useEffect(() => {
    // THE MOCK NEVER ASKS THE SERVER (design 2A). Its rows are filtered on the
    // client below, so a located or filtered re-fetch would only be thrown away.
    if (SCROLL_USES_MOCK) return;
    if (settledKeyRef.current === requestKey) return;
    let cancelled = false;
    if (requestKey === UNFILTERED_DECK_KEY) {
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        settledKeyRef.current = requestKey;
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
        settledKeyRef.current = requestKey;
        setGeoDeck(result.deck.map((p) => enrichPlaceOverview(p)));
      })
      .catch((err) => {
        if (cancelled) return;
        settledKeyRef.current = requestKey;
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
  //
  // THE EF'S ORDER IS KEPT (MESITA-2047). The deck arrives banded — open and
  // near first, then open within reach, closed within reach, other cities
  // last — with the bought slots already placed inside each band. A client
  // re-sort that floated promoting places used to run here and would lift a
  // promoting CLOSED place above every open card.
  //
  // AN EMPTY LOCATED ANSWER NEVER BLANKS A GOOD SHARED DECK when the guest set
  // no filter. The engine backfills far and closed places, so an unfiltered
  // located deck is only empty when the catalog is — but if it ever comes back
  // empty anyway, the coordless deck is still a true answer, and "No places
  // yet" over a catalog that has places is the bug this issue fixed.
  const rows = useMemo(() => {
    const located =
      geoDeck && (geoDeck.length > 0 || hasDiscoveryPredicates(filters))
        ? geoDeck
        : null;
    // The switch replaces the WHOLE source, never part of it: fake and real
    // cards never share a feed (design 2A).
    const source = SCROLL_USES_MOCK ? scrollMockPlaces() : (located ?? places);
    const listed = source.filter((place) => {
      if (place.googleOnly || place.from_google) {
        return filters.placesScope === "google";
      }
      return true;
    });
    const withDistance = listed.map((p) => withUserDistance(p, center));
    return applyDiscoveryFilters(withDistance, filters);
  }, [geoDeck, places, center, filters]);

  // THE DECK IS ALWAYS 50, CYCLED (Pato, live: "the deck must be 50 items.
  // then it repeats. if n is one, fill the 50 items deck with the same place.
  // for the moment").
  //
  // WHAT IT CYCLES DEPENDS ON ONE SWITCH. With SCROLL_USES_MOCK on (MESITA-2105,
  // Pato, 2026-10-10: "for the moment use mock data written in the frontend")
  // it is the twelve shared mock places; off, it is whatever is real, the way
  // it was from 2026-09-08 when Pato killed the last mock. That reversal is
  // deliberate and bounded: one file, one switch, Scroll only, and the exit is
  // MESITA-2095. A mock card can never reach Favs, analytics or a place URL
  // (scrollCardActions).
  //
  // TEMPORARY, and the instruction said so. When the catalog holds 50+ this
  // slice is a plain `rows.slice(0, DECK_SIZE)` and the modulo goes away.
  const deck = useMemo(() => {
    if (rows.length === 0) return [];
    return Array.from(
      { length: DECK_SIZE },
      (_, i) => rows[i % rows.length] as Place,
    );
  }, [rows]);

  const saveReal = (place: Place, saved: boolean) => {
    if (saved) {
      upsertSavedPlacePreview(place);
      setSaved(place.id, true);
      // First save only. The filled heart is the receipt from then on; a toast
      // on every save would be noise on a surface built for volume.
      if (savedIds.size === 0) toast.success("Saved — find it in Favs");
    } else {
      setSaved(place.id, false);
    }
  };
  const realSavedIds = hydrated ? savedIds : EMPTY_IDS;

  const hasDeck = deck.length > 0;

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
      frame = requestAnimationFrame(() => {
        writeScrollPosition(el.scrollTop);
        if (el.clientHeight > 0) {
          setActive(Math.round(el.scrollTop / el.clientHeight));
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
    // Re-attach when the list itself comes back: a filter that empties the
    // deck unmounts the <ul>, and a listener bound to the old node would
    // leave `active` (and so every card's eager photos) frozen.
  }, [hasDeck]);

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
        "shadow-elev absolute top-3 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[0.98]",
        appliedCount > 0
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card/95 text-foreground",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      {appliedCount > 0 && (
        <span className="bg-foreground text-paper type-meta absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-bold tabular-nums">
          {appliedCount}
        </span>
      )}
    </button>
  );

  // TWO DIFFERENT FAILURES, TWO DIFFERENT SCREENS. A deck that came back empty
  // means the catalog is still filling; a deck that FAILED means we could not
  // ask. Telling a guest the catalog is empty when the request 502'd sends them
  // away from a screen that a retry would have fixed. While the mock is on the
  // server's answer is not read at all, so its failure is not shown either.
  if (deck.length === 0) {
    if (fetchError && !SCROLL_USES_MOCK) {
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
        <div className="absolute inset-0 flex flex-col">
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

  const backToTop = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    // A DEFINITE BOX, TWICE OVER. This root is `absolute inset-0` inside the
    // page's `relative` wrapper, and the <ul> is `absolute inset-0` inside it,
    // so every card's `h-full` resolves to the scrollport. Every child here is
    // absolute, so a root that ASKED for its height (`flex-1` under a block
    // parent, a39d4f40) got 0px and the whole feed vanished behind the filter
    // disc for seventeen days. `scroll-layout-contract.test.tsx` pins this.
    //
    // NO `gap`: with full-height snap items a gap is a strip you can come to
    // rest on, showing two half cards.
    <div className="absolute inset-0">
      {filtersDisc}
      {filtersSheet}

      <ul
        ref={scrollerRef}
        aria-label="Places"
        tabIndex={0}
        className="scrollbar-hide absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-y-contain focus-visible:outline-none"
      >
        {deck.map((place, i) => {
          const actions = scrollCardActions(place, i, {
            isMock: isMockPlace(place),
            savedIds: realSavedIds,
            mockSavedIds,
            toast,
            saveReal,
            setMockSaved,
            track: (event, props) => trackEvent(supabase, event, props),
            share: (p) => void sharePlace(p),
            openReserve: setReservePlace,
            profileHref: (p) => placeHref(p.slug ?? p.id),
          });
          return (
            <ScrollCard
              // The same place appears many times in a cycled deck, so the id
              // alone is not unique.
              key={`${place.id}-${i}`}
              place={place}
              index={i}
              total={deck.length}
              near={Math.abs(i - active) <= 1}
              priority={i === 0}
              {...actions}
            />
          );
        })}

        {/* The list needs a terminal snap point, not a route-level empty
            screen — scrolling past the last card into blank space is the
            failure the stack deck answered with ExhaustedDeck. */}
        <li className="flex h-full shrink-0 snap-start snap-always flex-col items-center justify-center gap-4 px-6 text-center">
          <div>
            <p className="text-foreground font-display text-base font-semibold tracking-tight">
              That&apos;s everywhere for now
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              You&apos;ve reached the end of tonight&apos;s places.
            </p>
          </div>
          <button
            type="button"
            onClick={backToTop}
            className="bg-foreground text-paper h-11 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98]"
          >
            Back to top
          </button>
        </li>
      </ul>

      <ScrollHint show={deck.length > 1} />

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
