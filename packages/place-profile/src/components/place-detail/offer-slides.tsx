"use client";

import { useState, useSyncExternalStore } from "react";

import { cn } from "../../lib/format";
import type { OfferSlide } from "../../lib/offers";

export { offerSlides, offersLabel, type OfferInput, type OfferSlide } from "../../lib/offers";

// THE OFFER SLIDES, ONE COPY FOR EVERY SCREEN (MESITA-4151). Home's offer
// button, Search's strip and the place screen's Offers tile read the same
// slides on the same clock, so a place says the same offer in the same words
// and colour wherever it appears. The buttons themselves stay with their
// screens (Home's is a link in web-consumer); this file is the words, the
// beat and the moving track.

// THE OFFER BEAT (MESITA-3467, Pato: "switching across all the offers, every
// two seconds ... like a carousel"): ONE clock for every offer button on the
// page, so the buttons on screen change together. It counts up every 2s while
// anything listens, and skips a beat while the page is hidden or was
// scrolled in the last 600ms, so nothing moves under a moving list.
export const OFFER_BEAT_MS = 2000;
/** The place screen's row: a time and an offer change together every
 *  second, 500ms still and a 500ms slide (Pato, MESITA-4160: "stuff must
 *  rotate every second, sync ... like this hour that bonus"). */
export const PAIR_BEAT_MS = 1000;
const SCROLL_QUIET_MS = 600;

let lastScrollAt = 0;
function onScroll() {
  lastScrollAt = Date.now();
}

/** One clock per period, shared by every button that reads it. */
type Beat = { count: number; subscribe: (listener: () => void) => () => void };
const beats = new Map<number, Beat>();

function beatFor(ms: number): Beat {
  const found = beats.get(ms);
  if (found) return found;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const b: Beat = {
    count: 0,
    subscribe(listener) {
      listeners.add(listener);
      if (!timer) {
        timer = setInterval(() => {
          if (document.hidden) return;
          if (Date.now() - lastScrollAt < SCROLL_QUIET_MS) return;
          b.count += 1;
          for (const l of listeners) l();
        }, ms);
        // Capture: lists scroll inside their own boxes, not the window.
        document.addEventListener("scroll", onScroll, { capture: true, passive: true });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
  beats.set(ms, b);
  return b;
}

/** The shared beat: a count that rises every `ms` (2s by default). The
 *  server render reads 0. */
export function useOfferBeat(ms: number = OFFER_BEAT_MS): number {
  const b = beatFor(ms);
  return useSyncExternalStore(b.subscribe, () => b.count, () => 0);
}

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduced(listener: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** The phone asks for less motion: the offer button holds one slide. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false);
}

/** The slide the shared beat shows now, plus the one it just left (for the
 *  slide-up). Under reduced motion it holds the first voucher slide, so the
 *  Offers page stays one tap away (MESITA-4151), else the first slide. */
export function useOfferSlide(slides: OfferSlide[], ms: number = OFFER_BEAT_MS): { index: number; previous: number | null } {
  const beatNow = useOfferBeat(ms);
  const reduced = useReducedMotion();
  // The beat this button first drew on: no slide-up on arrival.
  const [firstBeat] = useState(beatNow);
  const n = slides.length;
  if (reduced) return { index: Math.max(0, slides.findIndex((s) => s.section !== null)), previous: null };
  if (n <= 1) return { index: 0, previous: null };
  const index = beatNow % n;
  return { index, previous: beatNow === firstBeat ? null : (beatNow - 1 + n) % n };
}

// THE SLIDE-UP (MESITA-3467): the old words leave upward, the new words rise
// from below, 300ms ease-out, clipped inside the still box. It ships with the
// track (MESITA-4151) so every app that draws the place screen has it; React
// hoists and dedupes the tag by its href. Reduced motion: no movement.
const OFFER_SLIDE_CSS = `@keyframes offer-in{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes offer-out{from{transform:translateY(0)}to{transform:translateY(-100%)}}
.offer-in{animation:offer-in 300ms ease-out both}
.offer-out{animation:offer-out 300ms ease-out both}
.offer-in-slow{animation:offer-in 500ms ease-out both}
.offer-out-slow{animation:offer-out 500ms ease-out both}
@media (prefers-reduced-motion:reduce){.offer-in,.offer-in-slow{animation:none}.offer-out,.offer-out-slow{display:none}}`;

/** The ink pill beside a slide's words. */
const OFFER_PILL =
  "bg-foreground text-paper shrink-0 rounded-md px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums";

function OfferWords({ slide, short = false, plain = false, className }: { slide: OfferSlide; short?: boolean; plain?: boolean; className?: string }) {
  return (
    <span className={cn("absolute inset-0 flex items-center justify-center gap-1.5", className)}>
      {/* A slide with no lead is the whole offer in the black tag (the place
          screen's Offers box, MESITA-4157). */}
      {plain ? (
        // The chip's words alone (the place screen's row, MESITA-4160):
        // "Prepay +30%", "Pay 5% Back", "Today 20:00".
        <span className="overflow-hidden text-center whitespace-pre-line">{slide.lead ? `${slide.lead} ${slide.pill}` : slide.pill}</span>
      ) : (
        <>
          {slide.lead ? <span className="truncate">{short ? slide.short : slide.lead}</span> : null}
          <span className={cn(OFFER_PILL, !slide.lead && "truncate")}>{slide.pill}</span>
        </>
      )}
    </span>
  );
}

/** The moving words inside a still box, hidden from screen readers (the
 *  box's label lists every offer once). Keyed by slide so each change replays
 *  the slide-up. */
export function OfferTrack({
  slides,
  index,
  previous,
  short,
  plain,
}: {
  slides: OfferSlide[];
  index: number;
  previous: number | null;
  short?: boolean;
  /** The place screen's chips: the words alone, a 500ms slide (MESITA-4160). */
  plain?: boolean;
}) {
  const inCls = plain ? "offer-in-slow" : "offer-in";
  const outCls = plain ? "offer-out-slow" : "offer-out";
  return (
    <span className="relative block h-full w-full overflow-hidden" aria-hidden>
      <style href="mesita-offer-slide" precedence="default">
        {OFFER_SLIDE_CSS}
      </style>
      {previous !== null ? (
        <OfferWords key={`out-${slides[previous].key}-${index}`} slide={slides[previous]} short={short} plain={plain} className={outCls} />
      ) : null}
      <OfferWords key={`in-${slides[index].key}`} slide={slides[index]} short={short} plain={plain} className={previous !== null ? inCls : undefined} />
    </span>
  );
}
