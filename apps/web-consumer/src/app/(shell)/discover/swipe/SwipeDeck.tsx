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
  createSeededRandom,
  deriveCategoryOptions,
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
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { SwipeActionRow } from "./swipe-action-row";
import {
  clearSwipeProgress,
  readSwipeProgress,
  writeSwipeProgress,
} from "./swipe-deck-storage";
import { SwipeDecisionBadge } from "./swipe-decision-badge";
import { SwipeExitStamp, SwipeTutorialOverlay } from "./swipe-deck-overlays";

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 0.35; // px/ms — a quick flick commits even with small displacement
const MIN_FLICK_DISTANCE = 16;
const MAX_FLICK_DURATION_MS = 250; // time since the last recorded move for a release to still count as a flick
const EXIT_ANIMATION_MS = 300;
const TUTORIAL_STORAGE_KEY = "mesita_swipe_tutorial_seen";
const TUTORIAL_AUTO_DISMISS_MS = 5500;
// How many upcoming cards' cover photos to pre-warm ahead of the active card.
const PRELOAD_CARDS_AHEAD = 3;
const DECISION_BADGE_THRESHOLD = 30; // px of drag before the Skip/Save badge lights up

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
  // The server-provided deck is ALWAYS the source of truth for card content:
  // every load re-runs Lineup, so an enrichment that landed since the last
  // visit shows up immediately. Stored progress only hides cards already
  // swiped (applied after mount, below) — it never supplies card data.
  const [runtimeDeck, setRuntimeDeck] = useState<Place[]>(places);
  // Ids swiped past this session. Seeded empty so the hydration render matches
  // the server's, then filled from sessionStorage after mount.
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [restarting, setRestarting] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "left" | "right">(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Reserve opens the booking sheet over the deck — the card already carries
  // the id + name the sheet needs, so there's no detour through /place/[id].
  const [reserveOpen, setReserveOpen] = useState(false);
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

  // Restore progress AFTER mount (client-only), so the hydration render stays
  // identical to the server's.
  useEffect(() => {
    const progress = readSwipeProgress();
    if (progress?.seenIds.length) {
      // Post-mount setState is intentional: the server has no sessionStorage,
      // so restoring here (rather than during render) is what keeps SSR and
      // hydration identical.
      /* eslint-disable react-hooks/set-state-in-effect */
      setSeenIds(progress.seenIds);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  // A fresh server deck replaces the runtime one outright — same reason as
  // above: content always comes from the latest Lineup run, never from a
  // previous render's copy.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setRuntimeDeck(places);
    setIdx(0);
    /* eslint-enable react-hooks/set-state-in-effect */
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
  // Distances measure from the chosen zone center (a searched location) or,
  // with none, the device fix — the same center the distance filter rings.
  const center = filters.zone ?? coords;
  const located = useMemo(
    () => runtimeDeck.map((v) => withUserDistance(v, center)),
    [runtimeDeck, center],
  );

  // The deck the user actually swipes (MESITA-646): the shared discovery
  // filters narrow `located` live, and the 0–5 randomness level (MESITA-672)
  // reorders it — jittered ranks in the middle, full shuffle at 5. Category
  // options derive from the RAW snapshot so the sheet offers everything this
  // deck actually has.
  // The seed pins the random permutation for the session: this memo also
  // re-runs when `located` merely changes identity (the geolocation fix
  // arriving, a zone recenter), and an unseeded shuffle would visibly swap
  // the top card mid-swipe.
  const [orderSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  // Cards already swiped this session drop out here rather than being skipped
  // by index: a re-run of Lineup can return a different order (or different
  // places entirely), which makes a stored position meaningless but leaves
  // "don't show me this again" perfectly well-defined.
  const seenSet = useMemo(() => new Set(seenIds), [seenIds]);
  const filtered = useMemo(
    () => applyDiscoveryFilters(located, filters),
    [located, filters],
  );
  const deck = useMemo(
    () =>
      orderByRandomness(
        filtered.filter((place) => !seenSet.has(place.id)),
        filters.randomness,
        createSeededRandom(orderSeed),
      ),
    [filtered, filters.randomness, orderSeed, seenSet],
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
  // Measured BEFORE the seen filter, so "your filters excluded everything"
  // and "you're caught up" stay distinct states — otherwise swiping the last
  // card would blame the filters.
  const filterEmptied = filtered.length === 0 && located.length > 0;
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
      setSeenIds((prev) => (prev.includes(currentId) ? prev : [...prev, currentId]));
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
      const result = await apiRecommendDeck(supabase, { limit: 50 });
      const sorted = [...result.deck].sort((a, b) => {
        const aRank = a.listing_type === "partner" ? 0 : 1;
        const bRank = b.listing_type === "partner" ? 0 : 1;
        return aRank - bRank;
      });
      const enriched = sorted.map((v) => enrichPlaceOverview(v));
      const fresh = shuffleDeck(enriched);
      setSeenIds([]);
      clearSwipeProgress();
      setRuntimeDeck(fresh);
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

  // The sheet rides along in EVERY branch — narrowing to zero results while
  // it's open must not unmount it mid-interaction.
  const sheet = (
    <FilterSheet
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      categoryOptions={categoryOptions}
      count={deck.length}
      hasLocation={coords != null}
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
          saved={saved}
          onOpenFilters={() => setFiltersOpen(true)}
          onSkip={skip}
          onOpenInfo={openInfo}
          onSave={save}
          onReserve={() => setReserveOpen(true)}
        />
      </div>

      {v && (
        <ReservationSheet
          place={{ id: v.id, name: v.name }}
          open={reserveOpen}
          onClose={() => setReserveOpen(false)}
        />
      )}

      {sheet}
    </div>
  );
}
