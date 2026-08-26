"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  CarouselMuteButton,
  CarouselPillDots,
  CarouselSlideCounter,
  CarouselTapZones,
} from "./image-carousel-chrome";

type MediaItem =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string };

export type CarouselMediaItem = MediaItem;

const TRANSFORM_PAGE_MS = 500;

// Eager-load a small window around the active slide so paging reveals the
// next photo instantly instead of waiting on a lazy fetch. Forward-biased
// because users page forward far more than back.
const PRELOAD_BEHIND = 1;
const PRELOAD_AHEAD = 2;

export function ImageCarousel({
  photos,
  media,
  alt,
  aspect = "aspect-[4/5]",
  rounded,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 420px",
  mutePosition = "bottom-right",
  noNativeScroll = false,
  objectFit = "cover",
  onIdxChange,
  onIdxSettled,
  onImageNaturalSize,
  hideSlides = false,
  className,
  renderSlide,
}: {
  photos: string[];
  media?: MediaItem[];
  alt: string;
  aspect?: string;
  rounded?: string;
  priority?: boolean;
  sizes?: string;
  mutePosition?: "bottom-right" | "top-right";
  objectFit?: "cover" | "contain";
  /**
   * When true, the inner track uses CSS transform paging instead of
   * native overflow-x scrolling. Required when this carousel sits inside
   * another horizontal-gesture handler (e.g. the SwipeDeck) — otherwise
   * the browser claims the touch for native scroll and the outer swipe
   * never fires.
   */
  noNativeScroll?: boolean;
  /**
   * Called whenever the active slide changes. Lets a parent react to
   * carousel position (e.g. fade out an overlay past the first photo).
   */
  onIdxChange?: (idx: number) => void;
  onIdxSettled?: (idx: number) => void;
  /** Reports natural pixel size once a slide's image finishes loading. */
  onImageNaturalSize?: (
    idx: number,
    size: { width: number; height: number },
  ) => void;
  /** Invisible slides — keeps paging + indicators while visuals live elsewhere. */
  hideSlides?: boolean;
  className?: string;
  /** Replaces the default full-bleed slide when the parent owns layout (e.g. swipe card). */
  renderSlide?: (idx: number, item: MediaItem) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);

  const items: MediaItem[] =
    media && media.length > 0
      ? media
      : photos.map((src) => ({ type: "image" as const, src }));

  const hasVideo = items.some((m) => m.type === "video");
  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  // Surface idx immediately for indicators; defer chrome/layout reactions until
  // the slide transform finishes so wide/tall chrome does not flip mid-transition.
  useEffect(() => {
    onIdxChange?.(idx);
    if (!noNativeScroll || !onIdxSettled) return;
    const t = window.setTimeout(() => onIdxSettled(idx), TRANSFORM_PAGE_MS);
    return () => window.clearTimeout(t);
  }, [idx, onIdxChange, onIdxSettled, noNativeScroll]);

  const goTo = (i: number) => {
    if (noNativeScroll) {
      setIdx(i);
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Tap-vs-drag detection for the invisible side-tap paging zones. The
  // earlier onClick-based approach fired on near-swipes that hadn't
  // committed (the browser's click-suppression-on-drag heuristic is
  // unreliable on mobile), so a small horizontal flick stopped the
  // parent swipe AND paged the photo. Now we time the gesture and only
  // page when the pointer barely moved within a short window — every
  // real swipe falls through to the parent SwipeDeck untouched.
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const handleZoneDown = (e: React.PointerEvent) => {
    tapRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const handleZoneUp =
    (direction: -1 | 1) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const start = tapRef.current;
      tapRef.current = null;
      if (!start) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      const dt = performance.now() - start.t;
      if (dx > 10 || dy > 10 || dt > 300) return;
      e.stopPropagation();
      const target =
        (((idx + direction) % items.length) + items.length) % items.length;
      // goTo reads ref.current — only invoked inside this pointerup
      // handler, never during render. The rule can't see that through
      // the curried handleZoneUp.
      // eslint-disable-next-line react-hooks/refs
      goTo(target);
    };
  const pageBy = (direction: -1 | 1) => {
    const target =
      (((idx + direction) % items.length) + items.length) % items.length;
    goTo(target);
  };

  // In transform mode every slide must already be eager (paging can't wait
  // on a lazy fetch); in native-scroll mode only a window around the active
  // slide is eager so neighbours are warm before you reach them.
  const isInPreloadWindow = (i: number) =>
    noNativeScroll || (i >= idx - PRELOAD_BEHIND && i <= idx + PRELOAD_AHEAD);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    // Pause non-active videos, play+unmute the active one.
    for (const [i, vid] of videoRefs.current.entries()) {
      if (!vid) continue;
      vid.muted = next;
      if (!next && i === idx) {
        // Browsers require the play() to be tied to the same user gesture as the unmute.
        vid.play().catch(() => {
          // If the browser still refuses, keep the icon honest.
          setMuted(true);
          vid.muted = true;
        });
      }
    }
  };

  // Keep videos muted when they're not the visible slide so audio doesn't overlap.
  useEffect(() => {
    for (const [i, vid] of videoRefs.current.entries()) {
      if (!vid) continue;
      const shouldHaveSound = !muted && i === idx;
      vid.muted = !shouldHaveSound;
    }
  }, [idx, muted]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        aspect,
        rounded,
        className,
      )}
    >
      <div
        ref={ref}
        onScroll={
          noNativeScroll
            ? undefined
            : (e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / el.clientWidth);
                if (i !== idx) setIdx(i);
              }
        }
        className={cn(
          "flex h-full w-full",
          noNativeScroll
            ? "transition-transform duration-500 ease-out"
            : "scrollbar-hide snap-x snap-mandatory overflow-x-auto",
        )}
        style={
          noNativeScroll
            ? { transform: `translateX(${-idx * 100}%)` }
            : undefined
        }
      >
        {items.map((m, i) => (
          <div
            key={`${m.src}-${i}`}
            className="relative h-full w-full flex-shrink-0 snap-center"
          >
            {renderSlide ? (
              renderSlide(i, m)
            ) : m.type === "video" ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={m.src}
                poster={m.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className={cn(
                  "h-full w-full",
                  fitClass,
                  hideSlides && "opacity-0",
                )}
              />
            ) : (
              <Image
                src={m.src}
                alt={`${alt} photo ${i + 1}`}
                fill
                sizes={sizes}
                priority={priority && i === 0}
                loading={
                  priority && i === 0
                    ? undefined
                    : isInPreloadWindow(i)
                      ? "eager"
                      : "lazy"
                }
                draggable={false}
                onLoad={(event) => {
                  const img = event.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    onImageNaturalSize?.(i, {
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  }
                }}
                className={cn(
                  fitClass,
                  hideSlides && "opacity-0",
                  "select-none [-webkit-user-drag:none]",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {hasVideo && (
        <CarouselMuteButton
          muted={muted}
          mutePosition={mutePosition}
          multiSlide={items.length > 1}
          onToggle={toggleMute}
        />
      )}

      {items.length > 1 && (
        <CarouselPillDots count={items.length} activeIdx={idx} />
      )}

      {items.length > 1 && (
        <CarouselTapZones
          onPointerDown={handleZoneDown}
          onPointerUpLeft={handleZoneUp(-1)}
          onPointerUpRight={handleZoneUp(1)}
          onKeyLeft={() => pageBy(-1)}
          onKeyRight={() => pageBy(1)}
        />
      )}

      {items.length > 1 && (
        <CarouselSlideCounter idx={idx} count={items.length} />
      )}
    </div>
  );
}
