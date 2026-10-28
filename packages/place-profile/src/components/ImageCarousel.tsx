"use client";

import { useRef, useState } from "react";
import { SizedImage } from "./SizedPhoto";
import { cn } from "../lib/format";
import {
  CarouselPillDots,
  CarouselSlideCounter,
  CarouselTapZones,
} from "./image-carousel-chrome";

type MediaItem = { src: string };

// Until the first photo lands, eager-load only a small window around the
// active slide so the first paint gets the bandwidth. Forward-biased because
// users page forward far more than back. Once it lands the carousel goes
// warm and every photo loads in the background at low priority, so a fast
// swipe never meets a blank slide (MESITA-2910).
const PRELOAD_BEHIND = 1;
const PRELOAD_AHEAD = 2;

export function ImageCarousel({
  photos,
  alt,
  aspect = "aspect-[4/5]",
  rounded,
  className,
  renderSlide,
  tapToPage = true,
  interactiveDots = false,
  onIdxChange,
}: {
  photos: string[];
  alt: string;
  aspect?: string;
  rounded?: string;
  className?: string;
  /** Replaces the default full-bleed slide when the parent owns layout (e.g.
   *  Scroll's card). `inPreloadWindow` is the same eager/lazy answer the
   *  default slide uses, so a custom slide can keep the preload window. */
  renderSlide?: (
    idx: number,
    item: MediaItem,
    ctx: { inPreloadWindow: boolean },
  ) => React.ReactNode;
  /**
   * The invisible left/right tap zones that page on a single tap. ON by
   * default — the place page depends on them. Scroll turns them off
   * (MESITA-2105): there a single tap does nothing and a double-tap saves, and
   * a zone that paged on the first tap would page twice before the save.
   */
  tapToPage?: boolean;
  /**
   * Dots become buttons (24px hit areas in a 44px row), ←/→ page the photos
   * from any focused element inside, the track itself is focusable, and the
   * "n / m" counter is dropped because the dots already say where you are.
   * OFF by default; Scroll turns it on so a mouse and a keyboard can still
   * page once the tap zones are gone.
   */
  interactiveDots?: boolean;
  /**
   * The photo on screen changed. Swipe and Scroll read it to give the card
   * the chrome THAT photo needs — the gradient for a cover, none for a
   * reflection (MESITA-2146).
   */
  onIdxChange?: (idx: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [warm, setWarm] = useState(false);

  const items: MediaItem[] = photos.map((src) => ({ src }));

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Tap-vs-drag detection for the invisible side-tap paging zones. An
  // onClick-based approach fires on near-swipes that never committed (the
  // browser's click-suppression-on-drag heuristic is unreliable on mobile),
  // so a small horizontal flick would page the photo. Instead we time the
  // gesture and only page when the pointer barely moved within a short
  // window — every real swipe is left to the native scroll.
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

  // A window around the active slide is eager so neighbours are warm before
  // you reach them; once the first photo has landed, every slide is.
  const isInPreloadWindow = (i: number) =>
    warm || (i >= idx - PRELOAD_BEHIND && i <= idx + PRELOAD_AHEAD);
  // A failed first photo must not hold the rest of the gallery back.
  const markWarm = () => setWarm(true);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        aspect,
        rounded,
        className,
      )}
      onKeyDown={
        interactiveDots && items.length > 1
          ? (e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              e.stopPropagation();
              pageBy(e.key === "ArrowLeft" ? -1 : 1);
            }
          : undefined
      }
    >
      <div
        ref={ref}
        tabIndex={interactiveDots && items.length > 1 ? 0 : undefined}
        aria-label={
          interactiveDots && items.length > 1
            ? `${alt}, photo ${idx + 1} of ${items.length}`
            : undefined
        }
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== idx) {
            setIdx(i);
            onIdxChange?.(i);
          }
        }}
        className="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto"
      >
        {items.map((m, i) => (
          <div
            key={`${m.src}-${i}`}
            className="relative h-full w-full flex-shrink-0 snap-center"
          >
            {renderSlide ? (
              renderSlide(i, m, { inPreloadWindow: isInPreloadWindow(i) })
            ) : (
              <SizedImage
                src={m.src}
                size="full"
                alt={`${alt} photo ${i + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 420px"
                loading={isInPreloadWindow(i) ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                onLoad={i === 0 ? markWarm : undefined}
                onError={i === 0 ? markWarm : undefined}
                draggable={false}
                className="object-cover select-none [-webkit-user-drag:none]"
              />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <CarouselPillDots
          count={items.length}
          activeIdx={idx}
          label={alt}
          onSelect={interactiveDots ? goTo : undefined}
        />
      )}

      {items.length > 1 && tapToPage && (
        <CarouselTapZones
          onPointerDown={handleZoneDown}
          onPointerUpLeft={handleZoneUp(-1)}
          onPointerUpRight={handleZoneUp(1)}
          onKeyLeft={() => pageBy(-1)}
          onKeyRight={() => pageBy(1)}
        />
      )}

      {items.length > 1 && !interactiveDots && (
        <CarouselSlideCounter idx={idx} count={items.length} />
      )}
    </div>
  );
}
