"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Ticket, Heart, Compass, RotateCcw, Hand } from "lucide-react";
import { VenueSwipeCardFace } from "@/components/guest/VenueSwipeCardFace";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 0.35; // px/ms — a quick flick commits even with small displacement
const MIN_FLICK_DISTANCE = 16;
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
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<null | "left" | "right">(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const lastRef = useRef({ x: 0, t: 0 });
  const lockedRef = useRef<null | "swipe" | "ignore">(null);

  // First-visit gesture hint. Persisted in localStorage so it shows
  // exactly once per browser. Dismissed on first swipe or after a
  // short timer — whichever happens first.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(TUTORIAL_STORAGE_KEY)) return;
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

  // Past the last card the deck is exhausted — no silent wrap. Looping
  // back to the first card with a tiny flash was reading as "the last
  // card got stuck" because the same card kept reappearing on small
  // catalogs. An explicit "you're caught up" state with a restart CTA
  // is clearer.
  const exhausted = idx >= venues.length;
  const v = exhausted ? null : venues[idx];
  const next = idx + 1 < venues.length ? venues[idx + 1] : null;

  const advance = () => {
    setIdx((i) => i + 1);
    setDragX(0);
    setExiting(null);
  };

  // Defensive reset whenever the visible card changes. Refs that lingered
  // across an advance (locked, capture, drag offset) were a plausible
  // source of "the next card doesn't accept gestures" reports.
  useEffect(() => {
    setDragX(0);
    setDragging(false);
    lockedRef.current = null;
  }, [idx]);

  const restart = () => {
    setIdx(0);
    setDragX(0);
    setExiting(null);
    lockedRef.current = null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    if (exiting) return;
    const t = performance.now();
    startRef.current = { x: e.clientX, y: e.clientY, t };
    lastRef.current = { x: e.clientX, t };
    setDragging(true);
    lockedRef.current = null;
    dismissTutorial();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (lockedRef.current == null) {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      // Wait for one axis to clearly dominate before locking. The old
      // "lock on first 6px crossing to whichever is bigger" logic
      // poisoned natural thumb-arc swipes into "ignore" forever the
      // moment dy briefly led at the start. Now horizontal locks fast
      // (low threshold, mild dominance) while vertical only locks on a
      // clearer, larger commit — so brief jitters don't kill the swipe.
      if (adx > 8 && adx > ady * 1.1) {
        lockedRef.current = "swipe";
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (ady > 14 && ady > adx * 1.4) {
        lockedRef.current = "ignore";
      }
    }
    if (lockedRef.current === "swipe") {
      setDragX(dx);
      lastRef.current = { x: e.clientX, t: performance.now() };
    }
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (lockedRef.current === "swipe") {
      const now = performance.now();
      const dt = Math.max(1, now - lastRef.current.t);
      const recentDx = lastRef.current.x - startRef.current.x;
      const totalDt = Math.max(1, now - startRef.current.t);
      const velocity = recentDx / totalDt;
      const isFlick =
        Math.abs(velocity) >= SWIPE_VELOCITY &&
        Math.abs(dragX) >= MIN_FLICK_DISTANCE &&
        dt < 250;
      if (Math.abs(dragX) > SWIPE_THRESHOLD || isFlick) {
        const dir =
          (Math.abs(velocity) > 0.05 ? velocity : dragX) > 0 ? "right" : "left";
        setExiting(dir);
      } else {
        setDragX(0);
      }
    } else {
      setDragX(0);
    }
    lockedRef.current = null;
  };

  const onLostPointerCapture = () => {
    if (!dragging) return;
    setDragging(false);
    setDragX(0);
    lockedRef.current = null;
  };

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(advance, 260);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  const exitOffset = exiting === "right" ? 600 : exiting === "left" ? -600 : 0;
  const visibleOffset = exiting ? exitOffset : dragX;
  const rotate = visibleOffset * 0.06;
  const isSwiping = Math.abs(dragX) > 8;

  const progress = exiting ? 1 : Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  const backScale = 0.94 + 0.06 * progress;
  const backOffsetY = 14 - 14 * progress;
  const backOpacity = 0.7 + 0.3 * progress;

  const skip = () => setExiting("left");
  const save = () => setExiting("right");

  if (exhausted || !v) {
    return <ExhaustedDeck onRestart={restart} />;
  }

  return (
    <div className="flex h-full flex-col px-3 pt-2 pb-3">
      <div className="relative flex-1">
        {next && (
          <div
            key={`back-${next.id}-${idx}`}
            className="pointer-events-none absolute inset-0 transition-[transform,opacity] duration-300 ease-out"
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
            !dragging && "transition-[transform,opacity] duration-300 ease-out",
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
            hrefInfo={`/venues/${v.id}`}
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
                right to save or reserve
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={skip}
          className="border-border bg-card text-foreground/75 hover:text-foreground flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-medium transition"
        >
          <X className="h-4 w-4" /> Skip
        </button>
        <button
          type="button"
          onClick={save}
          className="bg-pink-gradient shadow-glow flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white"
        >
          <Ticket className="h-4 w-4" /> Save or Reserve
        </button>
      </div>
    </div>
  );
}

function ExhaustedDeck({ onRestart }: { onRestart: () => void }) {
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
        className="bg-foreground text-background mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90"
      >
        <RotateCcw className="h-4 w-4" />
        Start over
      </button>
    </div>
  );
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
