"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PlaceSwipeCardFace } from "@/components/consumer/PlaceSwipeCardFace";
import { SWIPE_CARD_CLIP } from "@/components/consumer/swipe-card-styles";
import { FilterSheet } from "@/components/consumer/FilterSheet";
import { cn } from "@/lib/utils";
import { useUserLocation } from "@/lib/use-user-location";
import { apiRecommendDeck, type Place } from "@/lib/api/places";
import { upsertSavedPlacePreview, useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { placeHref } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
  deriveWhereOptions,
  discoveryFiltersAreActive,
  orderByRandomness,
} from "@/lib/discovery-filters-engine";
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";
import {
  EmptyDeck,
  ExhaustedDeck,
  FilterEmptyDeck,
  shuffleDeck,
  withUserDistance,
} from "./swipe-deck-shells";
import { SwipeActionRow } from "./swipe-action-row";
import { readSwipeSnapshot, writeSwipeSnapshot } from "./swipe-deck-storage";
import { SwipeDecisionBadge } from "./swipe-decision-badge";
import { SwipeExitStamp, SwipeTutorialOverlay } from "./swipe-deck-overlays";

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 0.35; // px/ms — a quick flick commits even with small displacement
const MIN_FLICK_DISTANCE = 16;
const EXIT_ANIMATION_MS = 300;
const TUTORIAL_STORAGE_KEY = "mesita_swipe_tutorial_seen";
const TUTORIAL_AUTO_DISMISS_MS = 5500;
// How many upcoming cards' cover photos to pre-warm ahead of the active card.
const PRELOAD_CARDS_AHEAD = 3;

export function SwipeDeck({
  places,
  fetchError,
  errorRetryHref = CONSUMER_ROUTES.home,
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
  // Seed from the server-provided deck so the first client render matches the
  // SSR HTML. The persisted snapshot is restored after mount (see below) —
  // reading sessionStorage during render trips a hydration mismatch because
  // the server has no storage to read.
  const [runtimeDeck, setRuntimeDeck] = useState<Place[]>(places);
  const [restarting, setRestarting] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "left" | "right">(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Shared discovery filters (MESITA-646): the deck below narrows LIVE and
  // the red Filter-action dot (MESITA-633) lights on any deviation from
  // defaults. One global store — Search shows the exact same state.
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

  // Restore a persisted deck + position AFTER mount (client-only), so the
  // hydration render stays identical to the server's.
  useEffect(() => {
    const snap = readSwipeSnapshot();
    if (snap?.runtimeDeck?.length) {
      // Post-mount setState is intentional: the server has no sessionStorage,
      // so restoring here (rather than during render) is what keeps SSR and
      // hydration identical.
      /* eslint-disable react-hooks/set-state-in-effect */
      setRuntimeDeck(snap.runtimeDeck);
      setIdx(Math.min(snap.idx, snap.runtimeDeck.length - 1));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  // Persist on change — but skip the initial mount so the fresh server deck
  // doesn't clobber a stored snapshot before the restore effect applies it.
  const didPersistMountRef = useRef(false);
  useEffect(() => {
    if (!didPersistMountRef.current) {
      didPersistMountRef.current = true;
      return;
    }
    writeSwipeSnapshot({ runtimeDeck, idx });
  }, [runtimeDeck, idx]);

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
    if (window.localStorage.getItem(TUTORIAL_STORAGE_KEY)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowTutorial(true);
    const t = window.setTimeout(() => {
      setShowTutorial(false);
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
    }, TUTORIAL_AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, []);

  const dismissTutorial = () => {
    if (!showTutorial) return;
    setShowTutorial(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
    }
  };

  // Real "X km" distances. The SSR deck fetch has no user location, so
  // places arrive without distance_km (the demo row carries a mock one).
  // Once the browser hands us a fix we recompute each card's distance
  // from its lat/lng — a real value always wins; places missing coords
  // (or a denied prompt) keep whatever distance they had, or fall back
  // to a "0 km" placeholder so the chip never just vanishes.
  const coords = useUserLocation();
  const located = useMemo(
    () => runtimeDeck.map((v) => withUserDistance(v, coords)),
    [runtimeDeck, coords],
  );

  // The deck the user actually swipes (MESITA-646): the shared discovery
  // filters narrow `located` live, and the randomness level (MESITA-650)
  // reorders it — jittered ranks at 1–2, full shuffle at 3. Option lists
  // derive from the RAW snapshot so the sheet offers everything this deck
  // actually has.
  const deck = useMemo(
    () =>
      orderByRandomness(
        applyDiscoveryFilters(located, filters),
        filters.randomness,
      ),
    [located, filters],
  );
  const whereOptions = useMemo(
    () => deriveWhereOptions(runtimeDeck),
    [runtimeDeck],
  );
  const categoryOptions = useMemo(
    () => deriveCategoryOptions(runtimeDeck),
    [runtimeDeck],
  );

  // Past the last card the deck is exhausted — no silent wrap. Looping
  // back to the first card with a tiny flash was reading as "the last
  // card got stuck" because the same card kept reappearing on small
  // catalogs. An explicit "you're caught up" state with a restart CTA
  // is clearer. Filters excluding EVERYTHING is a distinct state — the
  // deck isn't empty and the user hasn't seen it all; their filters did it.
  const filterEmptied = deck.length === 0 && located.length > 0;
  const exhausted = idx >= deck.length;
  const v = exhausted ? null : deck[idx];
  const next = idx + 1 < deck.length ? deck[idx + 1] : null;

  const advance = useCallback(() => {
    clearAdvanceTimer();
    exitingRef.current = null;
    resetGesture();
    setIdx((i) => i + 1);
    setExiting(null);
  }, [clearAdvanceTimer, resetGesture]);

  const beginExit = useCallback(
    (dir: "left" | "right") => {
      if (exitingRef.current) return;
      if (dir === "right" && v) {
        const alreadySaved = isSaved(v.id);
        upsertSavedPlacePreview(v);
        setSaved(v.id, true);
        if (!alreadySaved) {
          toast.action(
            `Saved ${v.name}`,
            {
              label: "View",
              onClick: () => router.push(CONSUMER_ROUTES.favorites),
            },
            { tone: "success" },
          );
        }
      }
      releaseCapture(cardElRef.current, activePointerIdRef.current);
      exitingRef.current = dir;
      resetGesture();
      setExiting(dir);
    },
    [isSaved, releaseCapture, resetGesture, router, setSaved, v],
  );

  const finishPointerGesture = useCallback(
    (el: HTMLElement | null, pointerId: number | null) => {
      if (!draggingRef.current) return;
      if (
        pointerId != null &&
        activePointerIdRef.current != null &&
        pointerId !== activePointerIdRef.current
      ) {
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
          dt < 250;

        if (Math.abs(dx) > SWIPE_THRESHOLD || isFlick) {
          const dir =
            (Math.abs(velocity) > 0.05 ? velocity : dx) > 0 ? "right" : "left";
          beginExit(dir);
          return;
        }
      }

      resetGesture();
    },
    [beginExit, releaseCapture, resetGesture],
  );

  const restart = async () => {
    if (restarting) return;
    setRestarting(true);
    clearAdvanceTimer();
    exitingRef.current = null;
    resetGesture();
    setExiting(null);
    try {
      const result = await apiRecommendDeck(supabase, { limit: 50 });
      const sorted = [...result.deck].sort((a, b) => {
        const aRank = a.listing_type === "partner" ? 0 : 1;
        const bRank = b.listing_type === "partner" ? 0 : 1;
        return aRank - bRank;
      });
      const enriched = sorted.map((v) => enrichPlaceOverview(v));
      const fresh = shuffleDeck(enriched);
      setRuntimeDeck(fresh);
      setIdx(0);
    } catch {
      // Fallback to server re-fetch path if client call fails.
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
    if (
      activePointerIdRef.current != null &&
      e.pointerId !== activePointerIdRef.current
    ) {
      return;
    }
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (lockedRef.current == null) {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx > 8 && adx > ady * 1.1) {
        lockedRef.current = "swipe";
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
    if (
      activePointerIdRef.current != null &&
      e.pointerId !== activePointerIdRef.current
    ) {
      return;
    }
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

  // The sheet rides along in EVERY branch — narrowing to zero results while
  // it's open must not unmount it mid-interaction.
  const sheet = (
    <FilterSheet
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      whereOptions={whereOptions}
      categoryOptions={categoryOptions}
      count={deck.length}
      hasLocation={coords != null}
      showRandomness
    />
  );

  if (filterEmptied) {
    return (
      <div className="relative flex h-full flex-col">
        <FilterEmptyDeck
          onAdjustFilters={() => setFiltersOpen(true)}
          onResetFilters={resetDiscoveryFilters}
        />
        {sheet}
      </div>
    );
  }

  if (exhausted || !v) {
    return (
      <div className="relative flex h-full flex-col">
        <ExhaustedDeck
          onRestart={restart}
          restarting={restarting}
          onAdjustFilters={
            filtersActive ? () => setFiltersOpen(true) : undefined
          }
        />
        {sheet}
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

            <SwipeDecisionBadge side="left" active={dragX < -30}>
              Skip
            </SwipeDecisionBadge>
            <SwipeDecisionBadge side="right" active={dragX > 30}>
              Save
            </SwipeDecisionBadge>
          </div>

          <SwipeExitStamp direction={exiting} />

          {showTutorial && <SwipeTutorialOverlay />}
        </div>

        <SwipeActionRow
          filtersActive={filtersActive}
          saved={saved}
          onOpenFilters={() => setFiltersOpen(true)}
          onSkip={skip}
          onOpenInfo={openInfo}
          onSave={save}
        />
      </div>

      {sheet}
    </div>
  );
}
