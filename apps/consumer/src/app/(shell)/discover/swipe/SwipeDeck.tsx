"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  X,
  Bookmark,
  Heart,
  Compass,
  RotateCcw,
  Hand,
  Store,
  Loader2,
  CalendarCheck,
  SlidersHorizontal,
} from "lucide-react";
import { VenueSwipeCardFace } from "@/components/consumer/VenueSwipeCardFace";
import { SWIPE_CARD_CLIP } from "@/components/consumer/swipe-card-styles";
import { FilterSheet } from "@/components/consumer/FilterSheet";
import { cn, haversineKm } from "@/lib/utils";
import { useUserLocation, type Coords } from "@/lib/use-user-location";
import { apiRecommendDeck, type Venue } from "@/lib/api/venues";
import { upsertSavedVenuePreview, useSavedVenues } from "@/lib/saved-venues";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { enrichVenueOverview } from "@/lib/mock/enrich-overview";

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 0.35; // px/ms — a quick flick commits even with small displacement
const MIN_FLICK_DISTANCE = 16;
const EXIT_ANIMATION_MS = 300;
const TUTORIAL_STORAGE_KEY = "mesita_swipe_tutorial_seen";
const TUTORIAL_AUTO_DISMISS_MS = 5500;

export function SwipeDeck({
  venues,
  fetchError,
}: {
  venues: Venue[];
  fetchError: string | null;
}) {
  if (fetchError) {
    return (
      <EmptyDeck
        title="Couldn't load venues"
        body={fetchError}
        actionHref="/discover/swipe"
        actionLabel="Try again"
      />
    );
  }
  if (venues.length === 0) {
    return (
      <EmptyDeck
        title="No venues yet"
        body="The catalog is empty. As partners onboard, their venues will show up here."
      />
    );
  }
  return <Deck venues={venues} />;
}

function Deck({ venues }: { venues: Venue[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useBrowserSupabase();
  const { isSaved, setSaved } = useSavedVenues();
  const [runtimeDeck, setRuntimeDeck] = useState<Venue[]>(venues);
  const [restarting, setRestarting] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "left" | "right">(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [infoOpeningVenueId, setInfoOpeningVenueId] = useState<string | null>(null);
  const cardElRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const lastRef = useRef({ x: 0, t: 0 });
  const lockedRef = useRef<null | "swipe" | "ignore">(null);
  const draggingRef = useRef(false);
  const dragXRef = useRef(0);
  const exitingRef = useRef<null | "left" | "right">(null);
  const activePointerIdRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setRuntimeDeck(venues);
  }, [venues]);

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
  // venues arrive without distance_km (the demo row carries a mock one).
  // Once the browser hands us a fix we recompute each card's distance
  // from its lat/lng — a real value always wins; venues missing coords
  // (or a denied prompt) keep whatever distance they had, or fall back
  // to a "0 km" placeholder so the chip never just vanishes.
  const coords = useUserLocation();
  const located = useMemo(
    () => runtimeDeck.map((v) => withUserDistance(v, coords)),
    [runtimeDeck, coords],
  );

  // Past the last card the deck is exhausted — no silent wrap. Looping
  // back to the first card with a tiny flash was reading as "the last
  // card got stuck" because the same card kept reappearing on small
  // catalogs. An explicit "you're caught up" state with a restart CTA
  // is clearer.
  const exhausted = idx >= located.length;
  const v = exhausted ? null : located[idx];
  const next = idx + 1 < located.length ? located[idx + 1] : null;

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
        upsertSavedVenuePreview(v);
        setSaved(v.id, true);
        if (!alreadySaved) {
          toast.action(
            `Saved ${v.name}`,
            { label: "View", onClick: () => router.push("/saved") },
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
      const enriched = sorted.map((v) => enrichVenueOverview(v));
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
    if (pathname.startsWith("/discover/")) {
      setInfoOpeningVenueId(null);
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

  if (exhausted || !v) {
    return <ExhaustedDeck onRestart={restart} restarting={restarting} />;
  }

  const skip = () => beginExit("left");
  const save = () => beginExit("right");
  const saved = isSaved(v.id);
  const isOpeningInfo = infoOpeningVenueId === v.id;

  const openInfo = () => {
    if (isOpeningInfo) return;
    setInfoOpeningVenueId(v.id);
    router.push(`/discover/${v.id}`);
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
              <VenueSwipeCardFace venue={next} className="absolute inset-0" />
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
            <VenueSwipeCardFace
              venue={v}
              carousel
              priority
              className="absolute inset-0"
            />

            <div
              className={cn(
                "bg-foreground/40 pointer-events-none absolute top-4 left-4 z-30 rounded-full border-2 border-white px-3 py-1 text-[11px] font-bold tracking-wider text-white uppercase transition-all",
                dragX < -30 ? "scale-100 opacity-100" : "scale-90 opacity-0",
              )}
            >
              Skip
            </div>
            <div
              className={cn(
                "bg-pink-gradient pointer-events-none absolute top-4 right-4 z-30 rounded-full px-3 py-1 text-[11px] font-bold tracking-wider text-white uppercase transition-all",
                dragX > 30 ? "scale-100 opacity-100" : "scale-90 opacity-0",
              )}
            >
              Save
            </div>
          </div>

          {exiting === "right" && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <span className="bg-pink-gradient shadow-glow animate-in fade-in zoom-in-50 inline-flex -rotate-[8deg] items-center gap-2 rounded-2xl border-[3px] border-white px-5 py-2.5 text-2xl font-black tracking-[0.15em] text-white uppercase duration-200 ease-out">
                <Heart className="h-6 w-6 fill-white" />
                Saved
              </span>
            </div>
          )}
          {exiting === "left" && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <span className="border-foreground/70 bg-foreground/85 text-background animate-in fade-in zoom-in-50 inline-flex rotate-[8deg] items-center gap-2 rounded-2xl border-[3px] px-5 py-2.5 text-2xl font-black tracking-[0.15em] uppercase duration-200 ease-out">
                <X className="h-6 w-6 stroke-[3]" />
                Skip
              </span>
            </div>
          )}

          {showTutorial && (
            <div className="animate-in fade-in pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] duration-500">
              <div className="flex flex-col items-center gap-5">
                <div className="animate-swipe-hint">
                  <Hand
                    className="h-20 w-20 text-white drop-shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
                    strokeWidth={1.4}
                  />
                </div>
                <p className="text-center text-[13px] font-medium tracking-wide text-white/95">
                  Swipe left to skip
                  <span className="mx-1.5 opacity-50">·</span>
                  right to save
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Five actions, Filter first. Tightened to text-xs + gap-1 so all
            five fit one row on a phone; Filter/Skip/Info read as neutral
            chrome, Save (soft pink) is the positive action. Reserve is
            parked while booking ships — rendered disabled + muted (the row
            is too tight for a "Soon" tag; the detail page CTA carries it).
            Filter opens the discovery filter sheet. */}
        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="border-border bg-card text-foreground/75 hover:text-foreground flex h-12 flex-1 items-center justify-center gap-1 rounded-full border text-xs font-medium whitespace-nowrap transition"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filter
          </button>
          <button
            type="button"
            onClick={skip}
            className="border-border bg-card text-foreground/75 hover:text-foreground flex h-12 flex-1 items-center justify-center gap-1 rounded-full border text-xs font-medium whitespace-nowrap transition"
          >
            <X className="h-4 w-4" /> Skip
          </button>
          <button
            type="button"
            onClick={openInfo}
            disabled={isOpeningInfo}
            aria-label={isOpeningInfo ? "Opening venue details" : "About this place"}
            className="border-border bg-card text-foreground/75 hover:text-foreground disabled:text-muted-foreground flex h-12 flex-1 items-center justify-center gap-1 rounded-full border text-xs font-medium whitespace-nowrap transition disabled:cursor-default"
          >
            {isOpeningInfo ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <>
                <Store className="h-4 w-4" /> Info
              </>
            )}
          </button>
          <button
            type="button"
            onClick={save}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-1 rounded-full border text-xs font-semibold whitespace-nowrap transition",
              saved
                ? "border-pink-500/50 bg-pink-500/20 text-pink-700"
                : "border-pink-500/40 bg-pink-500/10 text-pink-600 hover:bg-pink-500/15",
            )}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="border-border bg-muted text-muted-foreground flex h-12 flex-1 cursor-not-allowed items-center justify-center gap-1 rounded-full border text-xs font-medium whitespace-nowrap"
          >
            <CalendarCheck className="h-4 w-4" /> Reserve
          </button>
        </div>
      </div>

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}

// Resolve a venue's distance_km against the consumer's live position. A
// real geolocated distance only ever replaces — never erases — what was
// there. lat/lng ride along as PostgREST-serialized strings at runtime,
// hence the coercion. When no distance can be computed (geolocation
// pending/denied, or the venue carries no coordinates) we keep any
// distance it already had, otherwise drop in a "0 km" placeholder so the
// chip still renders. Real readings floor at 0.1 km, so "0 km" is
// unambiguously the "couldn't calculate" case and never a true distance.
function withUserDistance(venue: Venue, coords: Coords | null): Venue {
  if (coords) {
    const lat = toCoord(venue.lat);
    const lng = toCoord(venue.lng);
    if (lat != null && lng != null) {
      const km = haversineKm(coords.lat, coords.lng, lat, lng);
      const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
      return { ...venue, distance_km: Math.max(rounded, 0.1) };
    }
  }
  return venue.distance_km != null ? venue : { ...venue, distance_km: 0 };
}

function toCoord(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function ExhaustedDeck({
  onRestart,
  restarting,
}: {
  onRestart: () => void;
  restarting: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
        <Compass className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        You&apos;re caught up
      </h2>
      <p className="text-muted-foreground max-w-xs text-sm">
        You&apos;ve seen every venue in this filter. Check the catalog or map,
        widen your filters, or start over from the top.
      </p>
      <button
        type="button"
        onClick={onRestart}
        disabled={restarting}
        className="bg-foreground text-background mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:cursor-default disabled:opacity-70"
      >
        {restarting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4" />
            Start over
          </>
        )}
      </button>
    </div>
  );
}

function shuffleDeck(input: Venue[]): Venue[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function EmptyDeck({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
        <Compass className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground max-w-xs text-sm">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="bg-foreground text-background mt-2 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
