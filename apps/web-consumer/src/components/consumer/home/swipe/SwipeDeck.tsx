"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PlaceSwipeCardFace } from "@/components/consumer/PlaceSwipeCardFace";
import { SWIPE_CARD_CLIP } from "@/components/consumer/swipe-card-styles";
import { cn, errMsg } from "@/lib/utils";
import { useUserLocation } from "@/lib/use-user-location";
import { apiRecommendDeck, type Place } from "@/lib/api/places";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { placeHref } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  EmptyDeck,
  ExhaustedDeck,
  LoadingDeck,
  shuffleDeck,
  withUserDistance,
} from "./swipe-deck-shells";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { GoSheet } from "@/components/consumer/place-detail/GoSheet";
import { SwipeActionRow } from "./swipe-action-row";
import {
  clearSwipeProgress,
  readSwipeProgress,
  writeSwipeProgress,
} from "./swipe-deck-storage";
import { SwipeDecisionBadge } from "./swipe-decision-badge";
import { SwipeExitStamp, SwipeTutorialOverlay } from "./swipe-deck-overlays";
import { isPromoting } from "@/lib/promo-rates";
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
} from "@/lib/discovery-filters-engine";
import {
  deckRequestKey,
  toDeckRequest,
  UNFILTERED_DECK_KEY,
} from "@/lib/discovery-filters-wire";
import { useDiscoveryFilters } from "@/lib/use-discovery-filters";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { usePrefetchDiscountQuotes } from "@/lib/discount-quotes";

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 0.35; // px/ms — a quick flick commits even with small displacement
const MIN_FLICK_DISTANCE = 16;
const MAX_FLICK_DURATION_MS = 250; // time since the last recorded move for a release to still count as a flick
const EXIT_ANIMATION_MS = 300;
const TUTORIAL_STORAGE_KEY = "mesita:swipe-tutorial-seen";
const TUTORIAL_STORAGE_KEY_LEGACY = "mesita_swipe_tutorial_seen";
const TUTORIAL_AUTO_DISMISS_MS = 5500;

/** Read the tutorial flag; one-shot migrate the pre-colon legacy key. */
function readTutorialSeen(): boolean {
  try {
    if (window.localStorage.getItem(TUTORIAL_STORAGE_KEY)) return true;
    if (window.localStorage.getItem(TUTORIAL_STORAGE_KEY_LEGACY)) {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
      window.localStorage.removeItem(TUTORIAL_STORAGE_KEY_LEGACY);
      return true;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return false;
}

function writeTutorialSeen(): void {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
    window.localStorage.removeItem(TUTORIAL_STORAGE_KEY_LEGACY);
  } catch {
    /* best-effort */
  }
}
// How many upcoming cards' cover photos to pre-warm ahead of the active card.
const PRELOAD_CARDS_AHEAD = 3;
const DECISION_BADGE_THRESHOLD = 30; // px of drag before the Skip/Save badge lights up
/** How many cards a deck request asks for. The EF's ceiling is the same 50. */
const DECK_LIMIT = 50;

/**
 * Everything a freshly-fetched deck needs before it can render: promoting rows
 * float to the top, then each card gains its overview fields. Mirrors
 * HomeDeckBoundary so a client refetch and the SSR fetch produce the same deck.
 */
function prepareDeck(rows: Place[]): Place[] {
  return [...rows]
    .sort((a, b) => (isPromoting(a) ? 0 : 1) - (isPromoting(b) ? 0 : 1))
    .map((v) => enrichPlaceOverview(v));
}

export function SwipeDeck({
  places,
  fetchError,
  errorRetryHref = CONSUMER_ROUTES.search,
}: {
  places: Place[];
  fetchError: string | null;
  /** Where the fetch-error "Try again" CTA lands — hosts embedding the
      deck outside /home pass their own route. */
  errorRetryHref?: string;
}) {
  if (fetchError) {
    return (
      <EmptyDeck
        title="Couldn't load places"
        body={fetchError}
        actionHref={errorRetryHref}
        actionLabel="Try again"
      />
    );
  }
  if (places.length === 0) {
    return (
      <EmptyDeck
        title="No places yet"
        body="The catalog is empty. As partners onboard, their places will show up here."
      />
    );
  }
  return <Deck places={places} />;
}

function Deck({ places }: { places: Place[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useBrowserSupabase();
  const { isSaved, setSaved } = useSavedPlaces();
  // The server-provided deck is ALWAYS the source of truth for card content:
  // every load fetches a fresh random sample of active places, so an
  // enrichment that landed since the last visit shows up immediately. Stored
  // progress only hides cards already swiped (applied after mount, below) —
  // it never supplies card data.
  const [runtimeDeck, setRuntimeDeck] = useState<Place[]>(places);
  // Warm every promoting card's engine quote in ONE request (MESITA-1019).
  // The deck renders a single card at a time but knows its whole sample up
  // front, so without this each swipe would pay for its own round trip before
  // the promo chip could say a number. Non-promoting places are filtered out
  // by the same gate the chip uses — they never need a quote.
  usePrefetchDiscountQuotes(
    useMemo(
      () => runtimeDeck.filter(isPromoting).map((p) => p.id),
      [runtimeDeck],
    ),
  );
  // Ids swiped past this session. Seeded empty so the hydration render matches
  // the server's, then filled from sessionStorage after mount.
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [restarting, setRestarting] = useState(false);
  // Whether a deck for a newer predicate set is in flight (MESITA-1153). The
  // SSR deck always arrives unfiltered — a server component cannot read the
  // sessionStorage the filter store lives in — so a session that opens with
  // predicates already set starts here and re-requests once.
  const [deckLoading, setDeckLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "left" | "right">(null);
  const [showTutorial, setShowTutorial] = useState(false);
  // Reserve opens the booking sheet over the deck — the card already carries
  // the id + name the sheet needs, so there's no detour through /place/[id].
  // It is no longer opened from the rail directly: Go owns the entry point
  // and SWAPS to it (MESITA-1072), because two LocalSheets sliding up from
  // the bottom at the same z-tier read as a rendering bug.
  const [reserveOpen, setReserveOpen] = useState(false);
  const [goOpen, setGoOpen] = useState(false);
  // Go mounts LAZILY and then stays mounted. GoSheet pulls the guest's
  // tickets (useConsumerTickets → an EF list + the shared notification poll)
  // so it must not load for the many guests who only ever swipe; but
  // unmounting it on close would kill LocalSheet's exit transition, which
  // needs the component alive for the slide-down. First tap arms it forever.
  const [goMounted, setGoMounted] = useState(false);
  // The filter sheet is LOCAL, not a route (MESITA-1236). The pre-teardown
  // version was a routed @modal at /filters with a host-context bus feeding it
  // the deck's count and categories; both are gone. Hosts pass props straight
  // down — Swipe and Search both mount this sheet. The bus only ever existed
  // because three surfaces shared a route.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useDiscoveryFilters();
  const filtersActive = discoveryFiltersAreActive(filters);
  const infoOpeningRef = useRef(false);
  const cardElRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const lastRef = useRef({ x: 0, t: 0 });
  const lockedRef = useRef<null | "swipe" | "ignore">(null);
  const draggingRef = useRef(false);
  const dragXRef = useRef(0);
  const exitingRef = useRef<null | "left" | "right">(null);
  const activePointerIdRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  /** Which predicate set `runtimeDeck` was fetched under (MESITA-1153). */
  const deckKeyRef = useRef<string>(UNFILTERED_DECK_KEY);

  // Restore progress AFTER mount (client-only), so the hydration render stays
  // identical to the server's. Schedule on rAF so setState stays out of the
  // effect body (same pattern as LocalOverlay / AiConnectModal).
  useEffect(() => {
    const progress = readSwipeProgress();
    if (!progress?.seenIds.length) return;
    const raf = requestAnimationFrame(() => {
      setSeenIds(progress.seenIds);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // A fresh server deck replaces the runtime one outright — same reason as
  // above: content always comes from the latest fetch, never from a previous
  // render's copy.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setRuntimeDeck(places);
      setIdx(0);
    });
    // The SSR deck is unfiltered by construction, so any active predicate set
    // is now stale against it — clearing the key re-arms the refetch below
    // (which lists `places` too) instead of leaving a filtered session
    // silently sitting on the full deck.
    deckKeyRef.current = UNFILTERED_DECK_KEY;
    return () => cancelAnimationFrame(raf);
  }, [places]);

  // Persist on change — but skip the initial mount so the empty seed doesn't
  // clobber stored progress before the restore effect applies it.
  const didPersistMountRef = useRef(false);
  useEffect(() => {
    if (!didPersistMountRef.current) {
      didPersistMountRef.current = true;
      return;
    }
    writeSwipeProgress({ seenIds });
  }, [seenIds]);

  const syncDragX = useCallback((x: number) => {
    dragXRef.current = x;
    setDragX(x);
  }, []);

  const releaseCapture = useCallback(
    (el: HTMLElement | null, pointerId: number | null) => {
      if (!el || pointerId == null) return;
      try {
        if (el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
      } catch {
        // Some browsers throw if capture was already released.
      }
    },
    [],
  );

  const resetGesture = useCallback(() => {
    draggingRef.current = false;
    dragXRef.current = 0;
    lockedRef.current = null;
    activePointerIdRef.current = null;
    setDragging(false);
    setDragX(0);
  }, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // First-visit gesture hint. Persisted in localStorage so it shows
  // exactly once per browser. Dismissed on first swipe or after a
  // short timer — whichever happens first.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readTutorialSeen()) return;
    const raf = requestAnimationFrame(() => {
      setShowTutorial(true);
    });
    const t = window.setTimeout(() => {
      setShowTutorial(false);
      writeTutorialSeen();
    }, TUTORIAL_AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  const dismissTutorial = () => {
    if (!showTutorial) return;
    setShowTutorial(false);
    if (typeof window !== "undefined") writeTutorialSeen();
  };

  // Real "X km" distances. The SSR deck fetch has no user location, so
  // places arrive without distance_km (the demo row carries a mock one).
  // Once the browser hands us a fix we recompute each card's distance
  // from its lat/lng — a real value always wins; places missing coords
  // (or a denied prompt) keep whatever distance they had, or fall back
  // to a "0 km" placeholder so the chip never just vanishes.
  const coords = useUserLocation();
  // Distances measure from the chosen zone center (a searched location) or,
  // with none, the device fix — the SAME center the distance filter rings, so
  // "within 5 km" and the "5 km" on the card can never disagree.
  const center = filters.zone ?? coords;

  // PREDICATES CUT ON THE SERVER (MESITA-1153). The deck EF caps at 50, so
  // narrowing a fetched deck in the browser meant a predicate matching a
  // fraction p of the catalog left ~50p cards however large the catalog grew —
  // "open now + one family + 2 km" could come back empty while the catalog held
  // plenty of matches. Sending the predicates makes the EF cut its POOL first,
  // so those 50 are drawn from places that already match. Everything below
  // still filters client-side: this fetch is asynchronous, `now` drifts, and
  // the EF is deliberately permissive wherever it can't evaluate a predicate.
  const wantedDeckKey = useMemo(
    () => deckRequestKey(filters, center),
    [filters, center],
  );
  useEffect(() => {
    // The key is claimed in a REF, not state: this effect must not re-run on
    // its own bookkeeping, and a failed fetch must not spin it.
    if (deckKeyRef.current === wantedDeckKey) return;
    deckKeyRef.current = wantedDeckKey;
    // Clearing every predicate goes back to the deck the host already holds.
    // That IS the unfiltered answer, so there is nothing to ask for.
    if (wantedDeckKey === UNFILTERED_DECK_KEY) {
      const restore = requestAnimationFrame(() => {
        setRuntimeDeck(places);
        setIdx(0);
      });
      return () => cancelAnimationFrame(restore);
    }
    let cancelled = false;
    // Scheduled, not called in the effect body — setState there cascades
    // renders (react-hooks/set-state-in-effect), the same reason every other
    // effect in this file hops a frame first.
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setDeckLoading(true);
    });
    apiRecommendDeck(supabase, toDeckRequest(filters, center, DECK_LIMIT))
      .then((result) => {
        if (cancelled) return;
        setRuntimeDeck(prepareDeck(result.deck));
        setIdx(0);
      })
      .catch((err) => {
        // Keep the deck we already have — the client-side pass still narrows
        // it, which is exactly the pre-MESITA-1153 behaviour.
        console.warn(
          "[swipe] filtered deck fetch failed, keeping deck:",
          errMsg(err, "filtered deck fetch failed"),
        );
      })
      .finally(() => {
        cancelAnimationFrame(raf);
        if (!cancelled) setDeckLoading(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [wantedDeckKey, places, filters, center, supabase]);

  const located = useMemo(
    () => runtimeDeck.map((v) => withUserDistance(v, center)),
    [runtimeDeck, center],
  );

  // Cards already swiped this session drop out here rather than being skipped
  // by index: each fetch can return a different order (or different places
  // entirely), which makes a stored position meaningless but leaves "don't
  // show me this again" perfectly well-defined.
  const seenSet = useMemo(() => new Set(seenIds), [seenIds]);
  // PREDICATES CUT, THE SERVER ORDERS. Nothing here reorders the deck —
  // consumer-web-recommend-swipe ranks it (Places Lineup · Swipe mask).
  // This is the SECOND pass of the same predicate set the fetch above already
  // sent: it catches the window before the filtered deck lands, the rows the
  // EF kept because it could not evaluate a predicate, and the minute-by-minute
  // drift of "open now".
  const filtered = useMemo(
    () =>
      applyDiscoveryFilters(located, filters).filter(
        (place) => !place.googleOnly && !place.from_google,
      ),
    [located, filters],
  );
  const deck = useMemo(
    () => filtered.filter((place) => !seenSet.has(place.id)),
    [filtered, seenSet],
  );
  // Derived from the UNFILTERED deck the host was handed, never from
  // `runtimeDeck` — which is now the server's filtered answer whenever a
  // predicate is set. Narrowing to one category must not delete every other
  // option and strand the guest there.
  const categoryOptions = useMemo(
    () => deriveCategoryOptions(places),
    [places],
  );

  // Past the last card the deck is exhausted — no silent wrap. Looping
  // back to the first card with a tiny flash was reading as "the last
  // card got stuck" because the same card kept reappearing on small
  // catalogs. An explicit "you're caught up" state with a restart CTA
  // is clearer.
  const exhausted = idx >= deck.length;
  const v = exhausted ? null : deck[idx];
  const next = idx + 1 < deck.length ? deck[idx + 1] : null;

  // `v` is the card being dismissed; capture it before the deck re-derives.
  const currentId = v?.id ?? null;
  const advance = useCallback(() => {
    clearAdvanceTimer();
    exitingRef.current = null;
    resetGesture();
    // Marking it seen removes it from `deck`, so the next card slides into
    // index 0 — no cursor to keep in sync with a deck that can change shape.
    if (currentId) {
      setSeenIds((prev) =>
        prev.includes(currentId) ? prev : [...prev, currentId],
      );
    } else {
      setIdx((i) => i + 1);
    }
    setExiting(null);
  }, [clearAdvanceTimer, resetGesture, currentId]);

  const beginExit = useCallback(
    (dir: "left" | "right") => {
      if (exitingRef.current) return;
      if (dir === "right" && v) {
        const alreadySaved = isSaved(v.id);
        upsertSavedPlacePreview(v);
        setSaved(v.id, true);
        if (!alreadySaved) {
          // No "View" action while Favorites is parked (2026-09-01) — same
          // reasoning as the place detail's Save toast. It pushed
          // CONSUMER_ROUTES.favorites, and that route left with the /home
          // hub. Restore both together when the shared deck un-parks.
          toast.success(`Saved ${v.name}`);
        }
      }
      releaseCapture(cardElRef.current, activePointerIdRef.current);
      exitingRef.current = dir;
      resetGesture();
      setExiting(dir);
    },
    // `router` left this list with the Saved toast's "View" action — the
    // callback no longer navigates. It is still used elsewhere in the file.
    [isSaved, releaseCapture, resetGesture, setSaved, v],
  );

  const isForeignPointer = useCallback((pointerId: number) => {
    return (
      activePointerIdRef.current != null &&
      pointerId !== activePointerIdRef.current
    );
  }, []);

  const finishPointerGesture = useCallback(
    (el: HTMLElement | null, pointerId: number | null) => {
      if (!draggingRef.current) return;
      if (pointerId != null && isForeignPointer(pointerId)) {
        return;
      }

      releaseCapture(el, pointerId);

      if (exitingRef.current) {
        resetGesture();
        return;
      }

      const dx = dragXRef.current;

      if (lockedRef.current === "swipe") {
        const now = performance.now();
        const dt = Math.max(1, now - lastRef.current.t);
        const recentDx = lastRef.current.x - startRef.current.x;
        const totalDt = Math.max(1, now - startRef.current.t);
        const velocity = recentDx / totalDt;
        const isFlick =
          Math.abs(velocity) >= SWIPE_VELOCITY &&
          Math.abs(dx) >= MIN_FLICK_DISTANCE &&
          dt < MAX_FLICK_DURATION_MS;

        if (Math.abs(dx) > SWIPE_THRESHOLD || isFlick) {
          const dir =
            (Math.abs(velocity) > 0.05 ? velocity : dx) > 0 ? "right" : "left";
          beginExit(dir);
          return;
        }
      }

      resetGesture();
    },
    [beginExit, isForeignPointer, releaseCapture, resetGesture],
  );

  const restart = async () => {
    if (restarting) return;
    setRestarting(true);
    clearAdvanceTimer();
    exitingRef.current = null;
    resetGesture();
    setExiting(null);
    try {
      // Start over inside the guest's filters, not around them: restarting an
      // unfiltered deck the predicates empty again just repeats this screen.
      const result = await apiRecommendDeck(
        supabase,
        toDeckRequest(filters, center, DECK_LIMIT),
      );
      const fresh = shuffleDeck(prepareDeck(result.deck));
      setSeenIds([]);
      clearSwipeProgress();
      setRuntimeDeck(fresh);
      deckKeyRef.current = wantedDeckKey;
      setIdx(0);
    } catch {
      // Fallback to server re-fetch path if client call fails.
      setSeenIds([]);
      clearSwipeProgress();
      router.refresh();
      setIdx(0);
    } finally {
      setRestarting(false);
    }
  };

  // Carousel photo taps call stopPropagation on pointerup, which prevents
  // the card from seeing the event in the bubble phase. Capture on window
  // runs first so deck drag state always clears when the pointer lifts.
  useEffect(() => {
    const onGlobalPointerEnd = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      finishPointerGesture(cardElRef.current, e.pointerId);
    };
    window.addEventListener("pointerup", onGlobalPointerEnd, true);
    window.addEventListener("pointercancel", onGlobalPointerEnd, true);
    return () => {
      window.removeEventListener("pointerup", onGlobalPointerEnd, true);
      window.removeEventListener("pointercancel", onGlobalPointerEnd, true);
    };
  }, [finishPointerGesture]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    if (exitingRef.current) return;
    const t = performance.now();
    startRef.current = { x: e.clientX, y: e.clientY, t };
    lastRef.current = { x: e.clientX, t };
    activePointerIdRef.current = e.pointerId;
    draggingRef.current = true;
    dragXRef.current = 0;
    lockedRef.current = null;
    setDragging(true);
    setDragX(0);
    dismissTutorial();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    if (isForeignPointer(e.pointerId)) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (lockedRef.current == null) {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx > 8 && adx > ady * 1.1) {
        lockedRef.current = "swipe";
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (ady > 14 && ady > adx * 1.4) {
        lockedRef.current = "ignore";
      }
    }
    if (lockedRef.current === "swipe") {
      syncDragX(dx);
      lastRef.current = { x: e.clientX, t: performance.now() };
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishPointerGesture(e.currentTarget, e.pointerId);
  };

  const onLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isForeignPointer(e.pointerId)) return;
    finishPointerGesture(e.currentTarget, e.pointerId);
  };

  useEffect(() => {
    if (!exiting) return;
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      advance();
    }, EXIT_ANIMATION_MS);
    return clearAdvanceTimer;
  }, [exiting, advance, clearAdvanceTimer]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);

  useEffect(() => {
    if (!pathname.startsWith(CONSUMER_ROUTES.place.prefix)) {
      infoOpeningRef.current = false;
    }
  }, [pathname]);

  const exitOffset = exiting === "right" ? 600 : exiting === "left" ? -600 : 0;
  const visibleOffset = exiting ? exitOffset : dragX;
  const rotate = visibleOffset * 0.06;
  const isSwiping = Math.abs(dragX) > 8;

  const progress = exiting ? 1 : Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  const backScale = 0.94 + 0.06 * progress;
  const backOffsetY = 14 - 14 * progress;
  const backOpacity = 0.7 + 0.3 * progress;

  useEffect(() => {
    if (!v) return;
    router.prefetch(placeHref(v.id));
    if (next) router.prefetch(placeHref(next.id));
  }, [router, v, next]);

  // Warm the browser cache for upcoming cards' cover photos so a swipe
  // reveals the next card instantly instead of fetching on mount. The back
  // card (idx+1) already renders its cover, so this mainly covers idx+2..+3.
  // Deck photos are raw <img> on the R2 URL (no Next optimizer), so a bare
  // Image() request warms the exact URL the card will render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (let i = 1; i <= PRELOAD_CARDS_AHEAD; i += 1) {
      const src = deck[idx + i]?.photos?.[0];
      if (src) {
        const img = new window.Image();
        img.src = src;
      }
    }
  }, [deck, idx]);

  // ONE element, mounted in BOTH return branches. The exhausted branch returns
  // early and never renders the rail, so a filter that empties the deck would
  // otherwise strand the guest on a screen whose only control restarts a deck
  // the same filter empties again.
  const filtersSheet = (
    <LocalSheet
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      ariaLabel="Filters"
    >
      <DiscoveryFilters
        onClose={() => setFiltersOpen(false)}
        categoryOptions={categoryOptions}
        count={deck.length}
        hasLocation={coords != null}
      />
    </LocalSheet>
  );

  if (exhausted || !v) {
    return (
      <div className="relative flex h-full flex-col">
        {deckLoading ? (
          <LoadingDeck />
        ) : (
          <ExhaustedDeck
            onRestart={restart}
            restarting={restarting}
            onAdjustFilters={
              filtersActive ? () => setFiltersOpen(true) : undefined
            }
          />
        )}
        {filtersSheet}
      </div>
    );
  }

  const skip = () => beginExit("left");
  const save = () => beginExit("right");
  const saved = isSaved(v.id);

  const openInfo = () => {
    if (infoOpeningRef.current) return;
    infoOpeningRef.current = true;
    router.push(placeHref(v.id), { scroll: false });
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-1 flex-col px-3 pt-2 pb-3">
        <div className={cn("relative flex-1", SWIPE_CARD_CLIP)}>
          {next && (
            <div
              key={`back-${next.id}-${idx}`}
              className={cn(
                "pointer-events-none absolute inset-0 transition-[transform,opacity] duration-300 ease-out",
                SWIPE_CARD_CLIP,
              )}
              style={{
                transform: `translate3d(0, ${backOffsetY}px, 0) scale(${backScale})`,
                opacity: backOpacity,
              }}
              aria-hidden
            >
              <PlaceSwipeCardFace place={next} className="absolute inset-0" />
            </div>
          )}

          <div
            ref={cardElRef}
            key={v.id}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onLostPointerCapture}
            // Block the browser's default HTML5 drag (image ghost, link drag).
            // Even with draggable={false} on the <Image> inside, vertical
            // pointer movement on mouse devices can still kick off a native
            // drag from descendant elements. Cancelling at the swipe card
            // root catches everything.
            onDragStart={(e) => e.preventDefault()}
            className={cn(
              "absolute inset-0 touch-none select-none [-webkit-touch-callout:none] [-webkit-user-drag:none]",
              SWIPE_CARD_CLIP,
              !dragging &&
                "transition-[transform,opacity] duration-300 ease-out",
              isSwiping && "cursor-grabbing",
              exiting && "pointer-events-none",
            )}
            style={{
              transform: `translate3d(${visibleOffset}px, ${Math.abs(visibleOffset) * 0.04}px, 0) rotate(${rotate}deg)`,
              opacity: exiting ? 0 : 1,
            }}
          >
            <PlaceSwipeCardFace
              place={v}
              carousel
              priority
              className="absolute inset-0"
            />

            <SwipeDecisionBadge
              side="left"
              active={dragX < -DECISION_BADGE_THRESHOLD}
            >
              Skip
            </SwipeDecisionBadge>
            <SwipeDecisionBadge
              side="right"
              active={dragX > DECISION_BADGE_THRESHOLD}
            >
              Save
            </SwipeDecisionBadge>
          </div>

          <SwipeExitStamp direction={exiting} />

          {showTutorial && <SwipeTutorialOverlay />}
        </div>

        <SwipeActionRow
          filtersActive={filtersActive}
          onOpenFilters={() => setFiltersOpen(true)}
          saved={saved}
          onSkip={skip}
          onOpenInfo={openInfo}
          onSave={save}
          onGo={() => {
            setGoMounted(true);
            setGoOpen(true);
          }}
        />
      </div>

      {filtersSheet}

      {v && goMounted && (
        <GoSheet
          place={v}
          open={goOpen}
          onClose={() => setGoOpen(false)}
          onReserve={() => {
            setGoOpen(false);
            setReserveOpen(true);
          }}
        />
      )}

      {v && (
        <ReservationSheet
          place={{ id: v.id, name: v.name }}
          open={reserveOpen}
          onClose={() => setReserveOpen(false)}
        />
      )}
    </div>
  );
}
