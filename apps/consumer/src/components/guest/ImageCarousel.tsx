"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaItem =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string };

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
  onIdxChange,
}: {
  photos: string[];
  media?: MediaItem[];
  alt: string;
  aspect?: string;
  rounded?: string;
  priority?: boolean;
  sizes?: string;
  mutePosition?: "bottom-right" | "top-right";
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

  // Surface idx changes upward so a parent (e.g. VenueSwipeCardFace) can
  // react to the active photo — used to hide the info overlay past the
  // first slide.
  useEffect(() => {
    onIdxChange?.(idx);
  }, [idx, onIdxChange]);

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
    (direction: -1 | 1) => (e: React.PointerEvent<HTMLDivElement>) => {
      const start = tapRef.current;
      tapRef.current = null;
      if (!start) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      const dt = performance.now() - start.t;
      if (dx > 10 || dy > 10 || dt > 300) return;
      const target = idx + direction;
      if (target < 0 || target >= items.length) return;
      e.stopPropagation();
      goTo(target);
    };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    // Pause non-active videos, play+unmute the active one.
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      vid.muted = next;
      if (!next && i === idx) {
        // Browsers require the play() to be tied to the same user gesture as the unmute.
        vid.play().catch(() => {
          // If the browser still refuses, keep the icon honest.
          setMuted(true);
          vid.muted = true;
        });
      }
    });
  };

  // Keep videos muted when they're not the visible slide so audio doesn't overlap.
  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      const shouldHaveSound = !muted && i === idx;
      vid.muted = !shouldHaveSound;
    });
  }, [idx, muted]);

  return (
    <div className={cn("relative w-full overflow-hidden", aspect, rounded)}>
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
            ? "transition-transform duration-300 ease-out"
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
            {m.type === "video" ? (
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
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={m.src}
                alt={`${alt} photo ${i + 1}`}
                fill
                sizes={sizes}
                priority={priority && i === 0}
                // Force eager in transform mode so paging shows the next
                // photo instantly instead of waiting on a lazy fetch.
                loading={
                  priority && i === 0
                    ? undefined
                    : noNativeScroll
                      ? "eager"
                      : "lazy"
                }
                draggable={false}
                className="object-cover select-none [-webkit-user-drag:none]"
              />
            )}
          </div>
        ))}
      </div>

      {hasVideo && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMute();
          }}
          aria-label={muted ? "Unmute video" : "Mute video"}
          data-no-swipe
          className={cn(
            "absolute z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/80",
            mutePosition === "top-right"
              ? items.length > 1
                ? "top-12 right-3"
                : "top-3 right-3"
              : "right-3 bottom-3",
          )}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      )}

      {items.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full bg-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition-all duration-200",
                i === idx ? "w-5 opacity-100" : "w-1.5 opacity-60",
              )}
            />
          ))}
        </div>
      )}

      {items.length > 1 && (
        <>
          <div
            role="button"
            aria-label="Previous photo"
            onPointerDown={handleZoneDown}
            onPointerUp={handleZoneUp(-1)}
            className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default"
          />
          <div
            role="button"
            aria-label="Next photo"
            onPointerDown={handleZoneDown}
            onPointerUp={handleZoneUp(1)}
            className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-default"
          />
        </>
      )}

      {items.length > 1 && (
        <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur">
          {idx + 1} / {items.length}
        </div>
      )}
    </div>
  );
}
